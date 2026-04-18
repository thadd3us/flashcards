import type { AnswerEvent } from '../types/answerEvent';

export const MISS_PENALTY_MS = 10_000;
export const DEFAULT_PROFICIENCY_WINDOW = 50;

export function geometricMean(values: number[]): number {
  if (values.length === 0) return 0;
  let sumLog = 0;
  for (const v of values) {
    sumLog += Math.log(Math.max(v, 1));
  }
  return Math.exp(sumLog / values.length);
}

export function computeProficiency(
  events: AnswerEvent[],
  windowSize = DEFAULT_PROFICIENCY_WINDOW,
): number {
  if (events.length === 0) return 0;
  const slice = events.slice(-windowSize);
  const speeds = slice.map((e) =>
    e.is_correct && !e.is_timeout ? Math.max(1, e.response_time_ms) : MISS_PENALTY_MS,
  );
  const gm = geometricMean(speeds);
  if (gm <= 0) return 0;
  return 1000 / gm;
}
