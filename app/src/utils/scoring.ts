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

// Rolling proficiency in RPM (answers per minute). Wrong / timed-out events
// get MISS_PENALTY_MS as their response time; we take the geometric mean of
// the resulting sequence and convert to RPM (60 000 ms per minute / GM ms).
//
// Using GM (not arithmetic mean) is invariant under reciprocation —
// GM(1/x) = 1/GM(x) — so "average the response times then reciprocate" and
// "average the rates directly" give the same answer.
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
  return 60_000 / gm;
}
