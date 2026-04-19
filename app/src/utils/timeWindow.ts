import type { AnswerEvent } from '../types/answerEvent';

export type TimeWindow = 'session' | 'day' | 'week' | 'month' | 'all';

export const TIME_WINDOWS: TimeWindow[] = ['session', 'day', 'week', 'month', 'all'];

export const WINDOW_LABELS: Record<TimeWindow, string> = {
  session: 'Session',
  day:     '24 h',
  week:    'Week',
  month:   'Month',
  all:     'All',
};

const WINDOW_MS: Partial<Record<TimeWindow, number>> = {
  day:   86_400_000,
  week:  7  * 86_400_000,
  month: 30 * 86_400_000,
};

// Filter `combined` (all-time + session) by the selected window.
// For 'session', returns only the current-session events.
export function filterByWindow(
  combined: AnswerEvent[],
  window: TimeWindow,
  sessionEvents: AnswerEvent[],
): AnswerEvent[] {
  if (window === 'session') return sessionEvents;
  if (window === 'all') return combined;
  const cutoff = Date.now() - WINDOW_MS[window]!;
  return combined.filter((e) => {
    const t = Date.parse(e.timestamp);
    return !Number.isNaN(t) && t >= cutoff;
  });
}
