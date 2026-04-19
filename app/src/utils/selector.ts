// FSRS-lite: per-card memory state + small shared parameter vector.
// The selector scores every card with a two-term "expected reward":
//   α · discovery   + β · fill_potential
// where α = 1 - findHolesVsReinforce, β = findHolesVsReinforce.
// These match the two reward components from the design notes:
//   1) discovery: show cards where the user's recent baseline is low
//   2) fill: reward for re-showing a card we might improve on;
//      scales with (1 - baseline) × (time since last attempt / stability)
//
// Params are fixed for now but structured so we can later fit them
// online from real rewards (e.g., per-answer regret reduction).

import { QUESTION_CATALOG, type Question } from '../types/question';
import { MISS_PENALTY_MS } from './scoring';
import type { AnswerEvent, SelectionProvenance, SpeedTier } from '../types/answerEvent';
import { classifyTier, computeAdaptiveTierThresholds } from '../types/answerEvent';

export const TIER_SCORE: Record<SpeedTier, number> = {
  instant: 1.0,
  fast: 0.7,
  slow: 0.35,
  miss: 0.0,
};

export interface FsrsParams {
  findHolesVsReinforce: number; // 0 = all discovery, 1 = all fill
  baselineWindow: number; // how many recent attempts on a card count toward baseline
  initialStabilityMs: number; // before any attempts
  stabilityGrowthPerQuality: number; // S *= 1 + growth · score on correct
  stabilityMissFactor: number; // S *= this on miss
  difficultyAdjust: number; // how fast difficulty moves per attempt
  softmaxTemperature: number; // exploration temperature for the selector
  coldStartBoost: number; // expected-reward bonus for unseen cards in cold-start prior
}

export const DEFAULT_PARAMS: FsrsParams = {
  findHolesVsReinforce: 0.5,
  baselineWindow: 5,
  initialStabilityMs: 45_000,
  stabilityGrowthPerQuality: 0.9,
  stabilityMissFactor: 0.4,
  difficultyAdjust: 0.15,
  softmaxTemperature: 0.25,
  coldStartBoost: 0.15,
};

export interface CardState {
  seen: number;
  lastSeenAt: number | null; // epoch ms
  baselineScore: number; // 0..1 rolling over baselineWindow
  stability: number; // ms
  difficulty: number; // 0..1
  recentScores: number[];
}

export function initialState(): CardState {
  return {
    seen: 0,
    lastSeenAt: null,
    baselineScore: 0,
    stability: 0,
    difficulty: 0.3,
    recentScores: [],
  };
}

export function applyAnswer(
  state: CardState,
  event: AnswerEvent,
  params: FsrsParams = DEFAULT_PARAMS,
  thresholds?: { fast: number; slow: number },
): CardState {
  const tier: SpeedTier = classifyTier(event, thresholds);
  const score = TIER_SCORE[tier];

  const recent = [...state.recentScores, score].slice(-params.baselineWindow);
  const baseline = recent.reduce((a, b) => a + b, 0) / recent.length;

  let stability = state.stability;
  if (stability <= 0) {
    stability = params.initialStabilityMs * (0.6 + score);
  } else if (tier === 'miss') {
    stability *= params.stabilityMissFactor;
  } else {
    stability *= 1 + params.stabilityGrowthPerQuality * score;
  }
  const DAY = 24 * 3600_000;
  stability = Math.max(5_000, Math.min(30 * DAY, stability));

  const dDelta =
    tier === 'miss'
      ? params.difficultyAdjust
      : -params.difficultyAdjust * score;
  const difficulty = Math.max(0, Math.min(1, state.difficulty + dDelta));

  const ts = Date.parse(event.timestamp);
  return {
    seen: state.seen + 1,
    lastSeenAt: Number.isNaN(ts) ? Date.now() : ts,
    baselineScore: baseline,
    stability,
    difficulty,
    recentScores: recent,
  };
}

export function computeStates(
  events: AnswerEvent[],
  params: FsrsParams = DEFAULT_PARAMS,
): Map<string, CardState> {
  // Derive percentile-based tier thresholds from the full history so scoring
  // is relative to this player's own speed distribution, not fixed ms cutoffs.
  const thresholds = computeAdaptiveTierThresholds(events) ?? undefined;
  const map = new Map<string, CardState>();
  for (const e of events) {
    const cur = map.get(e.question_uuid) ?? initialState();
    map.set(e.question_uuid, applyAnswer(cur, e, params, thresholds));
  }
  return map;
}

export function retrievability(state: CardState, now: number): number {
  if (state.seen === 0 || state.lastSeenAt == null || state.stability <= 0) {
    return 0.05;
  }
  const elapsed = Math.max(0, now - state.lastSeenAt);
  return Math.exp(-elapsed / state.stability);
}

export interface RewardBreakdown {
  discovery: number;
  fill: number;
  total: number;
}

export function expectedReward(
  state: CardState | undefined,
  now: number,
  params: FsrsParams = DEFAULT_PARAMS,
): RewardBreakdown {
  const alpha = 1 - params.findHolesVsReinforce;
  const beta = params.findHolesVsReinforce;

  if (!state || state.seen === 0) {
    // Cold start: maximum discovery, high fill (time-since is "forever").
    const discovery = 1 + params.coldStartBoost;
    const fill = 1;
    return { discovery, fill, total: alpha * discovery + beta * fill };
  }

  const headroom = 1 - state.baselineScore; // room to improve
  const elapsed = state.lastSeenAt == null ? 0 : Math.max(0, now - state.lastSeenAt);
  // Cap at 1: a card that's 2× overdue isn't twice as worth drilling as one
  // that's exactly due. Without this cap, slow players accumulate many high-fill
  // seen cards that permanently out-score the unseen exploration floor.
  const due = Math.min(1, elapsed / Math.max(1, state.stability));
  // Discovery: weight headroom by difficulty so harder cards feel more worth probing.
  const discovery = headroom * (0.5 + 0.5 * state.difficulty);
  // Fill: potential improvement (headroom) scaled by how "due" it is.
  const fill = headroom * due;
  return { discovery, fill, total: alpha * discovery + beta * fill };
}

// The exploration floor for unseen cards, calibrated pessimistically: we
// assume any unseen card is as hard as the player's worst observed 5th-percentile
// card. This means only genuinely-mastered seen cards score above the floor;
// everything mediocre loses to the temptation of exploring something new.
export function pessimisticUnseenBaseline(
  states: Map<string, CardState>,
  params: FsrsParams = DEFAULT_PARAMS,
): { total: number; source: 'prior' | 'pessimistic-p95' } {
  const alpha = 1 - params.findHolesVsReinforce;
  const beta = params.findHolesVsReinforce;

  const seen = [...states.values()].filter((s) => s.seen > 0);
  if (seen.length === 0) {
    // Cold start: generous prior to bootstrap exploration.
    return { total: alpha * (1 + params.coldStartBoost) + beta * 1, source: 'prior' };
  }

  const baselines = seen.map((s) => s.baselineScore).sort((a, b) => a - b);
  const difficulties = seen.map((s) => s.difficulty).sort((a, b) => a - b);

  // 5th-percentile baseline = worst-performing slice → maximises headroom assumption
  const p5Baseline = baselines[Math.floor((baselines.length - 1) * 0.05)];
  // 95th-percentile difficulty = hardest observed difficulty
  const p95Difficulty = difficulties[Math.floor((difficulties.length - 1) * 0.95)];

  const headroom = 1 - p5Baseline;
  const discovery = headroom * (0.5 + 0.5 * p95Difficulty);
  const fill = headroom; // assume fully due (never seen before)

  return { total: alpha * discovery + beta * fill, source: 'pessimistic-p95' };
}

export interface SelectorOptions {
  avoid?: Set<string>;
  rng?: () => number;
  params?: FsrsParams;
}

export interface Selection {
  question: Question;
  provenance: SelectionProvenance;
}

const TOP_K = 5;

function paramsSnapshot(p: FsrsParams): Record<string, number> {
  return { ...p };
}

export function selectNextCard(
  history: AnswerEvent[],
  opts: SelectorOptions = {},
): Selection {
  const params = opts.params ?? DEFAULT_PARAMS;
  const avoid = opts.avoid ?? new Set<string>();
  const rng = opts.rng ?? Math.random;
  const states = computeStates(history, params);
  const now = Date.now();
  const baselineInfo = pessimisticUnseenBaseline(states, params);
  const baseline = baselineInfo.total;

  // Unified pool: every non-avoided card gets a score.
  // Unseen cards score at the pessimistic baseline so they collectively
  // outweigh low-scoring seen cards proportionally to their count —
  // no special gate needed.
  const pool: Array<{ q: Question; score: number; kind: 'seen' | 'unseen' }> = [];
  for (const q of QUESTION_CATALOG) {
    if (avoid.has(q.uuid)) continue;
    const s = states.get(q.uuid);
    if (!s || s.seen === 0) {
      pool.push({ q, score: baseline, kind: 'unseen' });
    } else {
      pool.push({ q, score: expectedReward(s, now, params).total, kind: 'seen' });
    }
  }

  const seenCount   = pool.filter((o) => o.kind === 'seen').length;
  const unseenCount = pool.filter((o) => o.kind === 'unseen').length;
  const snapshot    = paramsSnapshot(params);

  const topChoices: SelectionProvenance['topChoices'] = pool
    .filter((o) => o.kind === 'seen')
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K)
    .map((o) => ({ questionUuid: o.q.uuid, score: o.score, kind: 'seen' as const }));
  if (unseenCount > 0) {
    topChoices.push({ questionUuid: '(unseen)', score: baseline, kind: 'unseen-bucket' as const });
  }

  const makeProv = (
    picker: SelectionProvenance['picker'],
    pickedScore: number,
  ): SelectionProvenance => ({
    picker,
    pickedScore,
    unseenBaseline: baseline,
    unseenBaselineSource: baselineInfo.source,
    unseenCount,
    seenCount,
    topChoices,
    params: snapshot,
  });

  if (pool.length === 0) {
    const q = QUESTION_CATALOG[Math.floor(rng() * QUESTION_CATALOG.length)];
    return { question: q, provenance: makeProv('fallback-random', 0) };
  }

  const temp = params.softmaxTemperature;

  // Deterministic mode (randomness = 0): argmax, ties broken uniformly.
  if (temp <= 0) {
    const best = pool.reduce((a, b) => (b.score > a.score ? b : a));
    const tied = pool.filter((o) => o.score >= best.score - 1e-9);
    const pick = tied[Math.floor(rng() * tied.length)];
    return { question: pick.q, provenance: makeProv('argmax', pick.score) };
  }

  // Softmax over the unified pool.
  const maxScore = pool.reduce((m, o) => Math.max(m, o.score), -Infinity);
  const weights  = pool.map((o) => Math.exp((o.score - maxScore) / temp));
  const total    = weights.reduce((a, b) => a + b, 0);
  if (!isFinite(total) || total <= 0) {
    const pick = pool[Math.floor(rng() * pool.length)];
    const picker = pick.kind === 'seen' ? 'softmax-seen' : 'softmax-unseen';
    return { question: pick.q, provenance: makeProv(picker, pick.score) };
  }
  let r = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) {
      const pick = pool[i];
      const picker = pick.kind === 'seen' ? 'softmax-seen' : 'softmax-unseen';
      return { question: pick.q, provenance: makeProv(picker, pick.score) };
    }
  }
  // Floating-point remainder: take the last element.
  const pick = pool[pool.length - 1];
  const picker = pick.kind === 'seen' ? 'softmax-seen' : 'softmax-unseen';
  return { question: pick.q, provenance: makeProv(picker, pick.score) };
}

export interface Difficulty {
  scrollSpeedPxPerSec: number;
  laneCount: number;
  spawnIntervalMs: number;
  // Target fall time in ms — the store computes scrollSpeedPxPerSec from this
  // and the measured container height.
  fallDurationMs: number;
}

// The fall/timeout duration is the `fallPercentile`-th percentile of the
// player's last 100 response times (wrongs count as MISS_PENALTY_MS). This
// means the player beats `fallPercentile`×100 % of cards before timing out —
// so faster play tightens the loop naturally.
function computeFallDuration(history: AnswerEvent[], percentile: number): number {
  if (history.length === 0) return 10_000;
  const times = history
    .slice(-100)
    .map((e) => (e.is_correct && !e.is_timeout ? e.response_time_ms : MISS_PENALTY_MS))
    .sort((a, b) => a - b);
  const idx = Math.floor((times.length - 1) * percentile);
  return Math.max(3_000, Math.min(60_000, times[idx] ?? 10_000));
}

export function estimateDifficulty(history: AnswerEvent[], fallPercentile = 0.9): Difficulty {
  const fallDurationMs = computeFallDuration(history, fallPercentile);
  return {
    scrollSpeedPxPerSec: 60, // overridden by gameStore once container height is known
    laneCount: 1,
    spawnIntervalMs: fallDurationMs,
    fallDurationMs,
  };
}
