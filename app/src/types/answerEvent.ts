import type { Question } from './question';

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
