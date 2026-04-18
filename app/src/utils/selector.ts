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
import type { AnswerEvent, SpeedTier } from '../types/answerEvent';
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

export interface SelectorOptions {
  avoid?: Set<string>;
  rng?: () => number;
  params?: FsrsParams;
}

export function selectNextCard(
  history: AnswerEvent[],
  opts: SelectorOptions = {},
): Question {
  const params = opts.params ?? DEFAULT_PARAMS;
  const avoid = opts.avoid ?? new Set<string>();
  const rng = opts.rng ?? Math.random;
  const states = computeStates(history, params);
  const now = Date.now();

  const scored: { q: Question; score: number }[] = [];
  for (const q of QUESTION_CATALOG) {
    if (avoid.has(q.uuid)) continue;
    const { total } = expectedReward(states.get(q.uuid), now, params);
    scored.push({ q, score: total });
  }

  // Softmax weighted sample (temperature controls exploration).
  const temp = Math.max(0.05, params.softmaxTemperature);
  const maxScore = scored.reduce((m, s) => Math.max(m, s.score), -Infinity);
  const weights = scored.map((s) => Math.exp((s.score - maxScore) / temp));
  const total = weights.reduce((a, b) => a + b, 0);
  if (!isFinite(total) || total <= 0) {
    return scored[Math.floor(rng() * scored.length)].q;
  }
  let r = rng() * total;
  for (let i = 0; i < scored.length; i++) {
    r -= weights[i];
    if (r <= 0) return scored[i].q;
  }
  return scored[scored.length - 1].q;
}

export interface Difficulty {
  scrollSpeedPxPerSec: number;
  laneCount: number;
}

export function estimateDifficulty(history: AnswerEvent[]): Difficulty {
  if (history.length < 3) {
    return { scrollSpeedPxPerSec: 55, laneCount: 1 };
  }
  const recent = history.slice(-20);
  const correct = recent.filter((e) => e.is_correct && !e.is_timeout);
  const accuracy = correct.length / recent.length;
  const avgMs = correct.length
    ? correct.reduce((a, e) => a + e.response_time_ms, 0) / correct.length
    : 6000;
  const speed = Math.round(
    Math.max(45, Math.min(200, (300 / Math.max(1, avgMs / 1000)) * accuracy + 40)),
  );
  let lanes = 1;
  if (accuracy >= 0.7 && avgMs < 3500) lanes = 2;
  if (accuracy >= 0.85 && avgMs < 2000) lanes = 3;
  if (accuracy >= 0.92 && avgMs < 1200) lanes = 4;
  return { scrollSpeedPxPerSec: speed, laneCount: lanes };
}
