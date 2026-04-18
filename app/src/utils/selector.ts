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
import type { AnswerEvent, SelectionProvenance, SpeedTier } from '../types/answerEvent';
import { classifyTier } from '../types/answerEvent';

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
  coldStartBoost: number; // expected-reward bonus for unseen cards
  unseenPriorWeight: number; // pseudo-observations for the fixed prior on the unseen baseline
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
  unseenPriorWeight: 8,
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
): CardState {
  const tier: SpeedTier = classifyTier(event);
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
  const map = new Map<string, CardState>();
  for (const e of events) {
    const cur = map.get(e.question_uuid) ?? initialState();
    map.set(e.question_uuid, applyAnswer(cur, e, params));
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
  const due = Math.min(3, elapsed / Math.max(1, state.stability));
  // Discovery: weight headroom by difficulty so harder cards feel more worth probing.
  const discovery = headroom * (0.5 + 0.5 * state.difficulty);
  // Fill: potential improvement (headroom) scaled by how "due" it is.
  const fill = headroom * due;
  return { discovery, fill, total: alpha * discovery + beta * fill };
}

// Expected reward for a card the user has never seen, computed from the fixed
// prior. This is the exploration floor: whenever no seen card has higher
// expected reward than this, we'd rather sample uniformly from the unseen pool.
export function unseenBaselineReward(params: FsrsParams = DEFAULT_PARAMS): RewardBreakdown {
  return expectedReward(undefined, Date.now(), params);
}

// Empirical update to the unseen baseline. Every time we picked a previously
// unseen card, we observed a sample of the true "unseen-pick" reward. We
// update the discovery component from those samples and blend with the prior
// using pseudo-counts from `params.unseenPriorWeight`.
//
// We only update discovery (not fill): first attempts realize fill = 0 by
// construction, so observations carry no fill signal.
export function empiricalUnseenDiscovery(
  history: AnswerEvent[],
): { sum: number; count: number } {
  const seen = new Set<string>();
  let sum = 0;
  let count = 0;
  for (const e of history) {
    if (seen.has(e.question_uuid)) continue;
    seen.add(e.question_uuid);
    const score = TIER_SCORE[classifyTier(e)];
    sum += 1 - score; // realized discovery
    count += 1;
  }
  return { sum, count };
}

export function blendedUnseenBaseline(
  history: AnswerEvent[],
  params: FsrsParams = DEFAULT_PARAMS,
): { total: number; source: 'prior' | 'empirical-blended' } {
  const alpha = 1 - params.findHolesVsReinforce;
  const beta = params.findHolesVsReinforce;
  const priorDiscovery = 1 + params.coldStartBoost;
  const priorFill = 1;
  const emp = empiricalUnseenDiscovery(history);
  if (emp.count === 0) {
    return { total: alpha * priorDiscovery + beta * priorFill, source: 'prior' };
  }
  const w = params.unseenPriorWeight;
  const blendedDiscovery = (priorDiscovery * w + emp.sum) / (w + emp.count);
  return {
    total: alpha * blendedDiscovery + beta * priorFill,
    source: 'empirical-blended',
  };
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
  const baselineInfo = blendedUnseenBaseline(history, params);
  const baseline = baselineInfo.total;

  const unseen: Question[] = [];
  const seen: { q: Question; score: number }[] = [];
  for (const q of QUESTION_CATALOG) {
    if (avoid.has(q.uuid)) continue;
    const s = states.get(q.uuid);
    if (!s || s.seen === 0) {
      unseen.push(q);
    } else {
      seen.push({ q, score: expectedReward(s, now, params).total });
    }
  }

  const snapshot = paramsSnapshot(params);
  const topChoices: SelectionProvenance['topChoices'] = [...seen]
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K)
    .map((s) => ({
      questionUuid: s.q.uuid,
      score: s.score,
      kind: 'seen' as const,
    }));
  if (unseen.length > 0) {
    topChoices.push({
      questionUuid: '(unseen-bucket)',
      score: baseline,
      kind: 'unseen-bucket' as const,
    });
  }

  const makeProv = (
    picker: SelectionProvenance['picker'],
    pickedScore: number,
  ): SelectionProvenance => ({
    picker,
    pickedScore,
    unseenBaseline: baseline,
    unseenBaselineSource: baselineInfo.source,
    unseenCount: unseen.length,
    seenCount: seen.length,
    topChoices,
    params: snapshot,
  });

  const pickUnseen = (picker: SelectionProvenance['picker']): Selection => {
    const q = unseen[Math.floor(rng() * unseen.length)];
    return { question: q, provenance: makeProv(picker, baseline) };
  };

  if (seen.length === 0 && unseen.length > 0) {
    return pickUnseen('unseen-floor');
  }
  if (seen.length === 0 && unseen.length === 0) {
    // Catalog fully avoided (shouldn't happen with 169 cards). Fall back.
    const q = QUESTION_CATALOG[Math.floor(rng() * QUESTION_CATALOG.length)];
    return { question: q, provenance: makeProv('fallback-random', 0) };
  }

  const bestSeenScore = seen.reduce((m, s) => Math.max(m, s.score), -Infinity);
  // Exploration floor: if no seen card's expected reward beats the (empirically
  // updated) unseen baseline, pick uniformly from unseen cards.
  if (unseen.length > 0 && bestSeenScore < baseline) {
    return pickUnseen('unseen-floor');
  }

  // Softmax over seen cards + one virtual unseen bucket at baseline reward.
  type Option =
    | { kind: 'seen'; q: Question; score: number }
    | { kind: 'unseen'; score: number };
  const options: Option[] = seen.map((s) => ({ kind: 'seen' as const, ...s }));
  if (unseen.length > 0) {
    options.push({ kind: 'unseen' as const, score: baseline });
  }

  const temp = Math.max(0.05, params.softmaxTemperature);
  const maxScore = options.reduce((m, o) => Math.max(m, o.score), -Infinity);
  const weights = options.map((o) => Math.exp((o.score - maxScore) / temp));
  const total = weights.reduce((a, b) => a + b, 0);
  if (!isFinite(total) || total <= 0) {
    if (unseen.length > 0) return pickUnseen('fallback-random');
    const q = seen[Math.floor(rng() * seen.length)].q;
    return { question: q, provenance: makeProv('fallback-random', 0) };
  }
  let r = rng() * total;
  for (let i = 0; i < options.length; i++) {
    r -= weights[i];
    if (r <= 0) {
      const pick = options[i];
      if (pick.kind === 'unseen') return pickUnseen('softmax-unseen');
      return {
        question: pick.q,
        provenance: makeProv('softmax-seen', pick.score),
      };
    }
  }
  const tail = options[options.length - 1];
  if (tail.kind === 'unseen') return pickUnseen('softmax-unseen');
  return { question: tail.q, provenance: makeProv('softmax-seen', tail.score) };
}

export interface Difficulty {
  scrollSpeedPxPerSec: number;
  laneCount: number;
  spawnIntervalMs: number;
  // Target fall time in ms — the store computes scrollSpeedPxPerSec from this
  // and the measured container height.
  fallDurationMs: number;
}

// Calibration defaults: one card at a time, 10 s to fall, one spawn every 10 s.
// Kept deliberately history-insensitive for now so we can tune the core feel
// without the autopilot fighting us.
export function estimateDifficulty(_history: AnswerEvent[]): Difficulty {
  return {
    scrollSpeedPxPerSec: 60, // overridden by gameStore once container height is known
    laneCount: 1,
    spawnIntervalMs: 10_000,
    fallDurationMs: 10_000,
  };
}
