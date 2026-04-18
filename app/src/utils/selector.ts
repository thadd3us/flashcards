import { QUESTION_CATALOG, type Question } from '../types/question';
import type { AnswerEvent } from '../types/answerEvent';

interface CardStat {
  seen: number;
  correctRate: number;
  avgMs: number;
  lastSeenIdx: number;
}

function computeStats(events: AnswerEvent[]): Map<string, CardStat> {
  const stats = new Map<string, CardStat>();
  events.forEach((e, i) => {
    const existing = stats.get(e.question_uuid) ?? {
      seen: 0,
      correctRate: 0,
      avgMs: 0,
      lastSeenIdx: -1,
    };
    const seen = existing.seen + 1;
    const correctRate =
      (existing.correctRate * existing.seen + (e.is_correct ? 1 : 0)) / seen;
    const avgMs =
      (existing.avgMs * existing.seen +
        (e.is_correct ? e.response_time_ms : 10_000)) /
      seen;
    stats.set(e.question_uuid, { seen, correctRate, avgMs, lastSeenIdx: i });
  });
  return stats;
}

export interface SelectorOptions {
  exploreVsExploit: number; // 0 = pure explore (uniform), 1 = pure exploit (hardest cards)
  avoid: Set<string>;
  rng?: () => number;
}

export function selectNextCard(
  history: AnswerEvent[],
  opts: Partial<SelectorOptions> = {},
): Question {
  const { exploreVsExploit = 0.55, avoid = new Set<string>(), rng = Math.random } = opts;
  const stats = computeStats(history);
  const weights: number[] = [];
  const pool: Question[] = [];

  QUESTION_CATALOG.forEach((q) => {
    if (avoid.has(q.uuid)) return;
    const s = stats.get(q.uuid);
    let difficulty: number;
    if (!s) {
      difficulty = 0.7; // unseen cards: lean toward showing them
    } else {
      // slower + less-correct = harder = higher weight
      const speedScore = Math.min(1, s.avgMs / 6000);
      const wrongScore = 1 - s.correctRate;
      difficulty = 0.5 * wrongScore + 0.5 * speedScore;
    }
    // recency bonus: cards not seen recently get a boost
    const recency = s ? Math.min(1, (history.length - s.lastSeenIdx) / 30) : 1;
    const explore = 0.3 + 0.7 * recency;
    const weight = (1 - exploreVsExploit) * explore + exploreVsExploit * (0.2 + difficulty);
    weights.push(Math.max(0.01, weight));
    pool.push(q);
  });

  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
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
