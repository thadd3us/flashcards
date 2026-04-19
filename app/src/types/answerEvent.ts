import type { Question } from './question';

export interface SelectionProvenance {
  // Which path in the selector chose this card.
  picker: 'argmax' | 'softmax-seen' | 'softmax-unseen' | 'fallback-random';
  // The expected reward the selector assigned to the picked card (or the unseen bucket) at selection time.
  pickedScore: number;
  // Baseline reward that unseen cards (in aggregate) would have contributed.
  unseenBaseline: number;
  unseenBaselineSource: 'prior' | 'pessimistic-p95';
  // Pool sizes at selection time.
  unseenCount: number;
  seenCount: number;
  // Top-K contenders for debugging.
  topChoices: Array<{
    questionUuid: string;
    score: number;
    kind: 'seen' | 'unseen-bucket';
  }>;
  // Params used (snapshot, so later we can analyze even if we change defaults).
  params: Record<string, number>;
}

export interface AnswerEvent {
  uuid: string;
  question_uuid: string;
  question: Question;
  username: string;
  timestamp: string;
  response_time_ms: number;
  is_correct: boolean;
  is_timeout: boolean;
  answer_submitted: number | null;
  app_version: string;
  // ISO timestamp of when this app launch (session) started. Used to bucket
  // events into discrete sessions for the "today earlier" CDF comparison.
  session_start_timestamp?: string;
  // Present when the card was chosen by the selector (not spawn-order cold start
  // before we had wiring). Omitted for seeded synthetic history in tests.
  selection_provenance?: SelectionProvenance;
  // True when the event was recorded during forced-correction mode (after an
  // initial wrong/timeout on this card). The first wrong/timeout event that
  // opened the correction has is_correction=false; every retry attempt inside
  // the overlay — wrong or right — has is_correction=true.
  is_correction?: boolean;
}

export type SpeedTier = 'instant' | 'fast' | 'slow' | 'miss';

export const SPEED_TIER_THRESHOLDS = {
  instant: 1000,
  fast: 3000,
  slow: 6000,
} as const;

// Optional adaptive thresholds: percentile cutpoints derived from the
// player's own recent response-time distribution (see computeAdaptiveTierThresholds).
// When omitted, falls back to the fixed millisecond constants above.
export function classifyTier(
  event: AnswerEvent,
  thresholds?: { fast: number; slow: number },
): SpeedTier {
  if (!event.is_correct || event.is_timeout) return 'miss';
  const rt = event.response_time_ms;
  if (thresholds) {
    if (rt <= thresholds.fast) return 'instant'; // fastest 25%
    if (rt >= thresholds.slow) return 'slow'; // slowest 25%
    return 'fast'; // middle 50%
  }
  if (rt < SPEED_TIER_THRESHOLDS.instant) return 'instant';
  if (rt < SPEED_TIER_THRESHOLDS.fast) return 'fast';
  return 'slow';
}

// Derive percentile cutpoints from the last `windowSize` correct answers.
// Returns null when there's not enough data to form a reliable distribution.
export function computeAdaptiveTierThresholds(
  events: AnswerEvent[],
  windowSize = 100,
): { fast: number; slow: number } | null {
  const times = events
    .slice(-windowSize)
    .filter((e) => e.is_correct && !e.is_timeout)
    .map((e) => e.response_time_ms)
    .sort((a, b) => a - b);
  if (times.length < 4) return null;
  // p25 of response times = boundary below which the fastest 25% fall
  // p75 of response times = boundary above which the slowest 25% fall
  return {
    fast: times[Math.floor((times.length - 1) * 0.25)],
    slow: times[Math.floor((times.length - 1) * 0.75)],
  };
}
