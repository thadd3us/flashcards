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

interface State {
  paused: boolean;
  cards: ActiveCard[];
  difficulty: Difficulty;
  containerHeight: number;
  nextIdCounter: number;
  laneSpawnNext: number; // round-robin lane index for spawning
}

export const useGameStore = defineStore('game', {
  state: (): State => ({
    paused: false,
    cards: [],
    difficulty: { scrollSpeedPxPerSec: 40, laneCount: 1 },
    containerHeight: 600,
    nextIdCounter: 0,
    laneSpawnNext: 0,
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
      this.containerHeight = h;
    },
    setPanic(on: boolean) {
      if (on) {
        this.difficulty = { ...this.difficulty, laneCount: 1 };
      }
    },
    updateDifficulty() {
      const session = useSessionStore();
      const next = estimateDifficulty(session.combinedHistory);
      if (session.panic) next.laneCount = 1;
      this.difficulty = next;
    },
    cardY(card: ActiveCard, now = performance.now()): number {
      return ((now - card.spawnedAt) / 1000) * this.difficulty.scrollSpeedPxPerSec;
    },
    spawnIfNeeded() {
      if (this.paused) return;
      const lanes = this.difficulty.laneCount;
      // ensure each lane has at least one card, and space cards vertically
      const byLane = new Map<number, ActiveCard[]>();
      for (const c of this.cards) {
        const arr = byLane.get(c.laneIndex) ?? [];
        arr.push(c);
        byLane.set(c.laneIndex, arr);
      }
      for (let lane = 0; lane < lanes; lane++) {
        const list = byLane.get(lane) ?? [];
        if (list.length === 0) {
          this.spawnOnLane(lane);
          continue;
        }
        // spawn a follow-up if the newest card has traveled >= 180px
        const newest = list.reduce((a, b) =>
          a.spawnedAt > b.spawnedAt ? a : b,
        );
        if (this.cardY(newest) >= 160) {
          this.spawnOnLane(lane);
        }
      }
      // remove stale lanes when difficulty drops
      this.cards = this.cards.filter((c) => c.laneIndex < lanes);
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
      this.paused = true;
      this.cards = [];
    },
    resumeGame() {
      this.paused = false;
      this.nextIdCounter = 0;
      this.spawnIfNeeded();
    },
    reset() {
      this.paused = false;
      this.cards = [];
      this.nextIdCounter = 0;
      this.difficulty = { scrollSpeedPxPerSec: 40, laneCount: 1 };
    },
    async submitAnswer(value: number) {
      if (this.paused) return null;
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
    },
  },
});
