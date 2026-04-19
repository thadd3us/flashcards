import { defineStore } from 'pinia';
import type { Question } from '../types/question';
import { selectNextCard, estimateDifficulty, type Difficulty } from '../utils/selector';
import type { SelectionProvenance } from '../types/answerEvent';
import { useSessionStore } from './sessionStore';

export interface ActiveCard {
  id: string;
  question: Question;
  laneIndex: number;
  spawnedAt: number; // performance.now()
  provenance: SelectionProvenance;
}

// Set while the user is being asked to correctly answer a just-missed card.
// Gameplay is frozen until they type the right answer.
export interface CorrectionState {
  question: Question;
  answerSubmitted: number | null; // null for timeout
  isTimeout: boolean;
  wrongAttempts: number; // how many incorrect tries during the correction
  // Provenance of the originally-selected card, reused for every correction
  // event so we can later analyze "how often do we retry this card?"
  provenance: SelectionProvenance;
  // performance.now() when the current attempt's stopwatch started. Reset
  // after each attempt so response_time_ms on each logged correction event
  // measures that attempt in isolation.
  attemptStartedAt: number;
}

interface State {
  paused: boolean;
  cards: ActiveCard[];
  difficulty: Difficulty;
  containerHeight: number;
  nextIdCounter: number;
  lastSpawnAt: number; // performance.now() of the most recent spawn (per any lane)
  correction: CorrectionState | null;
  fallPercentile: number; // 0.5–0.99: which pct of recent response times sets fall duration
}

// Cards fall across (containerHeight - MISS_ZONE_PX) over difficulty.fallDurationMs.
const MISS_ZONE_PX = 72;

const DEFAULT_SPAWN_MS = 10_000;
const DEFAULT_FALL_MS = 10_000;

// `?fast=<ms>` URL override — used by Playwright tests so they don't have to
// wait the full 10 s between cards. Invalid / missing → real defaults.
function readUrlOverride(): { spawn: number; fall: number } {
  if (typeof window === 'undefined') {
    return { spawn: DEFAULT_SPAWN_MS, fall: DEFAULT_FALL_MS };
  }
  const p = new URLSearchParams(window.location.search).get('fast');
  const n = p ? parseInt(p, 10) : NaN;
  if (!Number.isFinite(n) || n < 100) {
    return { spawn: DEFAULT_SPAWN_MS, fall: DEFAULT_FALL_MS };
  }
  return { spawn: n, fall: n };
}

function defaultDifficulty(): Difficulty {
  const o = readUrlOverride();
  return {
    scrollSpeedPxPerSec: 60,
    laneCount: 1,
    spawnIntervalMs: o.spawn,
    fallDurationMs: o.fall,
  };
}

export const useGameStore = defineStore('game', {
  state: (): State => ({
    paused: false,
    cards: [],
    difficulty: defaultDifficulty(),
    containerHeight: 600,
    nextIdCounter: 0,
    lastSpawnAt: -Infinity,
    correction: null,
    fallPercentile: 0.9,
  }),
  getters: {
    lowestCard(state): ActiveCard | null {
      const now = performance.now();
      let best: ActiveCard | null = null;
      let bestY = -Infinity;
      for (const c of state.cards) {
        const y = ((now - c.spawnedAt) / 1000) * state.difficulty.scrollSpeedPxPerSec;
        if (y > bestY) {
          bestY = y;
          best = c;
        }
      }
      return best;
    },
  },
  actions: {
    setContainerHeight(h: number) {
      if (h === this.containerHeight) return;
      this.containerHeight = h;
      this.recalibrateSpeed();
    },
    recalibrateSpeed() {
      const travelPx = Math.max(200, this.containerHeight - MISS_ZONE_PX);
      this.difficulty = {
        ...this.difficulty,
        scrollSpeedPxPerSec: travelPx / (this.difficulty.fallDurationMs / 1000),
      };
    },
    setPanic(on: boolean) {
      if (on) {
        this.difficulty = { ...this.difficulty, laneCount: 1 };
      }
    },
    updateDifficulty() {
      const session = useSessionStore();
      const next = estimateDifficulty(session.combinedHistory, this.fallPercentile);
      if (session.panic) next.laneCount = 1;
      // Only apply the ?fast= URL override when it's explicitly present (tests).
      const hasUrlOverride =
        typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('fast') !== null;
      if (hasUrlOverride) {
        const o = readUrlOverride();
        next.spawnIntervalMs = o.spawn;
        next.fallDurationMs = o.fall;
      }
      this.difficulty = next;
      this.recalibrateSpeed();
    },
    setFallPercentile(p: number) {
      this.fallPercentile = Math.max(0.5, Math.min(0.99, p));
      this.updateDifficulty();
    },
    cardY(card: ActiveCard, now = performance.now()): number {
      return ((now - card.spawnedAt) / 1000) * this.difficulty.scrollSpeedPxPerSec;
    },
    spawnIfNeeded() {
      if (this.paused || this.correction) return;
      const lanes = this.difficulty.laneCount;
      // Drop cards that belong to a now-disabled lane.
      this.cards = this.cards.filter((c) => c.laneIndex < lanes);

      // Always keep each lane populated. No cadence gate: as soon as a card
      // is answered or expires, the next one appears. When idle, the fall
      // duration (10 s default) naturally caps spawn rate at ~1 per lane per
      // fall interval.
      for (let lane = 0; lane < lanes; lane++) {
        const laneHasCard = this.cards.some((c) => c.laneIndex === lane);
        if (!laneHasCard) {
          this.spawnOnLane(lane);
          this.lastSpawnAt = performance.now();
        }
      }
    },
    spawnOnLane(lane: number) {
      const session = useSessionStore();
      const avoid = new Set(this.cards.map((c) => c.question.uuid));
      const sel = selectNextCard(session.combinedHistory, { avoid });
      this.cards.push({
        id: `c${this.nextIdCounter++}`,
        question: sel.question,
        laneIndex: lane,
        spawnedAt: performance.now(),
        provenance: sel.provenance,
      });
    },
    removeCard(id: string) {
      this.cards = this.cards.filter((c) => c.id !== id);
    },
    pauseGame() {
      if (this.correction) return; // correction blocks the pause toggle
      this.paused = true;
      this.cards = [];
    },
    enterCorrection(c: Omit<CorrectionState, 'wrongAttempts' | 'attemptStartedAt'>) {
      this.correction = {
        ...c,
        wrongAttempts: 0,
        attemptStartedAt: performance.now(),
      };
      // Clear any other cards on the field; the user will only see the red
      // correction overlay until they type the right answer.
      this.cards = [];
    },
    // Log each correction attempt (wrong or right) as its own AnswerEvent with
    // is_correction=true. Returns true if the value matched the answer.
    async submitCorrection(value: number): Promise<boolean> {
      if (!this.correction) return false;
      const session = useSessionStore();
      const now = performance.now();
      const responseMs = Math.max(0, now - this.correction.attemptStartedAt);
      const isCorrect = value === this.correction.question.answer;
      await session.recordAnswer({
        question: this.correction.question,
        responseMs,
        isCorrect,
        isTimeout: false,
        answerSubmitted: value,
        provenance: this.correction.provenance,
        isCorrection: true,
      });
      if (!isCorrect) {
        this.correction.wrongAttempts += 1;
        this.correction.attemptStartedAt = now;
        return false;
      }
      this.correction = null;
      this.lastSpawnAt = -Infinity; // spawn the next card on the next tick
      this.updateDifficulty();
      return true;
    },
    resumeGame() {
      this.paused = false;
      this.nextIdCounter = 0;
      this.lastSpawnAt = -Infinity; // spawn immediately on next tick
      this.spawnIfNeeded();
    },
    reset() {
      this.paused = false;
      this.cards = [];
      this.nextIdCounter = 0;
      this.lastSpawnAt = -Infinity;
      this.difficulty = defaultDifficulty();
      this.recalibrateSpeed();
    },
    async submitAnswer(value: number) {
      if (this.paused || this.correction) return null;
      const session = useSessionStore();
      const target = this.lowestCard;
      if (!target) return null;
      const responseMs = performance.now() - target.spawnedAt;
      const isCorrect = value === target.question.answer;
      await session.recordAnswer({
        question: target.question,
        responseMs,
        isCorrect,
        isTimeout: false,
        answerSubmitted: value,
        provenance: target.provenance,
      });
      this.removeCard(target.id);
      this.updateDifficulty();
      if (!isCorrect) {
        this.enterCorrection({
          question: target.question,
          answerSubmitted: value,
          isTimeout: false,
          provenance: target.provenance,
        });
      }
      return { tier: session.lastTier, correct: isCorrect };
    },
    async expireCard(id: string) {
      const session = useSessionStore();
      const card = this.cards.find((c) => c.id === id);
      if (!card) return;
      const responseMs = performance.now() - card.spawnedAt;
      await session.recordAnswer({
        question: card.question,
        responseMs,
        isCorrect: false,
        isTimeout: true,
        answerSubmitted: null,
        provenance: card.provenance,
      });
      this.removeCard(id);
      this.updateDifficulty();
      this.enterCorrection({
        question: card.question,
        answerSubmitted: null,
        isTimeout: true,
        provenance: card.provenance,
      });
    },
  },
});
