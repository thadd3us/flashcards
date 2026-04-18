import type { Question } from './question';

export interface SelectionProvenance {
  // Which path in the selector chose this card.
  picker: 'unseen-floor' | 'softmax-seen' | 'softmax-unseen' | 'fallback-random';
  // The expected reward the selector assigned to the picked card (or the unseen bucket) at selection time.
  pickedScore: number;
  // Baseline reward that unseen cards (in aggregate) would have contributed.
  unseenBaseline: number;
  unseenBaselineSource: 'prior' | 'empirical-blended';
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

export function classifyTier(event: AnswerEvent): SpeedTier {
  if (!event.is_correct) return 'miss';
  if (event.response_time_ms < SPEED_TIER_THRESHOLDS.instant) return 'instant';
  if (event.response_time_ms < SPEED_TIER_THRESHOLDS.fast) return 'fast';
  return 'slow';
}
