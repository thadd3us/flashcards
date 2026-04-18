<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { useGameStore, type ActiveCard } from '../stores/gameStore';
import { useSessionStore } from '../stores/sessionStore';
import { playTierSound } from '../composables/useAudio';
import TierFlash from './TierFlash.vue';
import ComboDisplay from './ComboDisplay.vue';

const game = useGameStore();
const session = useSessionStore();

const field = ref<HTMLDivElement | null>(null);
const input = ref<HTMLInputElement | null>(null);
const typed = ref('');

const cardPositions = ref(new Map<string, number>());
const showPr = ref(false);
let prTimer: number | null = null;

function containerHeight(): number {
  return field.value?.clientHeight ?? 600;
}

let raf = 0;
function tick() {
  const h = containerHeight();
  game.setContainerHeight(h);
  const now = performance.now();
  const next = new Map<string, number>();
  const expired: string[] = [];
  for (const c of game.cards) {
    const y = game.cardY(c, now);
    next.set(c.id, y);
    if (y >= h - 72) expired.push(c.id);
  }
  cardPositions.value = next;
  for (const id of expired) {
    game.expireCard(id).then(() => {
      if (session.lastTier) playTierSound(session.lastTier);
    });
  }
  game.spawnIfNeeded();
  raf = requestAnimationFrame(tick);
}

onMounted(() => {
  game.updateDifficulty();
  game.spawnIfNeeded();
  raf = requestAnimationFrame(tick);
  input.value?.focus();
});

onBeforeUnmount(() => {
  cancelAnimationFrame(raf);
});

watch(
  () => session.lastPr?.key,
  (k) => {
    if (!k) return;
    showPr.value = true;
    if (prTimer) clearTimeout(prTimer);
    prTimer = window.setTimeout(() => (showPr.value = false), 1200);
  },
);

async function submit() {
  const v = parseInt(typed.value, 10);
  typed.value = '';
  if (Number.isNaN(v)) return;
  const result = await game.submitAnswer(v);
  if (result?.tier) playTierSound(result.tier);
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
    e.preventDefault();
    triggerPanic();
  }
}

function triggerPanic() {
  session.setPanic(!session.panic);
  game.setPanic(session.panic);
  game.updateDifficulty();
}

function togglePause() {
  if (game.paused) {
    game.resumeGame();
    input.value?.focus();
  } else {
    game.pauseGame();
  }
}

const lowestId = computed(() => game.lowestCard?.id ?? null);

function laneCards(lane: number): ActiveCard[] {
  return game.cards.filter((c) => c.laneIndex === lane);
}

function isPr(c: ActiveCard): boolean {
  if (!session.lastPr) return false;
  return session.lastPr.questionUuid === c.question.uuid && showPr.value;
}

function cardStyle(id: string): Record<string, string> {
  const y = cardPositions.value.get(id) ?? 0;
  return { top: `${y}px` };
}
</script>

<template>
  <div class="play" @keydown="onKey" tabindex="0">
    <div ref="field" class="field" data-testid="field">
      <div class="lane-grid" :style="{ gridTemplateColumns: `repeat(${game.difficulty.laneCount}, 1fr)` }">
        <div
          v-for="lane in game.difficulty.laneCount"
          :key="lane"
          class="lane"
        >
          <div class="lane-guide" />
          <div
            v-for="c in laneCards(lane - 1)"
            :key="c.id"
            class="card"
            :class="{ target: c.id === lowestId, pr: isPr(c) }"
            :style="cardStyle(c.id)"
            :data-testid="`card-${c.question.uuid}`"
          >
            <div class="content">{{ c.question.content }} = ?</div>
          </div>
        </div>
      </div>

      <TierFlash />

      <div v-if="game.paused" class="paused-overlay" data-testid="paused">
        <div class="paused-text glow">PAUSED</div>
        <button class="primary" @click="togglePause">Resume</button>
      </div>
    </div>

    <div class="control-bar panel">
      <div class="left">
        <ComboDisplay />
      </div>
      <div class="center">
        <input
          ref="input"
          v-model="typed"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          autocomplete="off"
          class="answer"
          placeholder="▓ answer ▓"
          data-testid="answer-input"
          :disabled="game.paused"
          @keydown.enter="submit"
        />
      </div>
      <div class="right">
        <button
          class="danger"
          data-testid="panic-btn"
          @click="triggerPanic"
          :class="{ armed: session.panic }"
        >
          {{ session.panic ? 'Panic ON' : 'Panic' }}
        </button>
        <button data-testid="pause-btn" @click="togglePause">
          {{ game.paused ? 'Resume' : 'Pause' }}
        </button>
      </div>
    </div>

    <div class="diag mono-caps">
      Scroll {{ game.difficulty.scrollSpeedPxPerSec }} px/s · Lanes
      {{ game.difficulty.laneCount }} · Combo {{ session.combo }}
    </div>
  </div>
</template>

<style scoped>
.play {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 0.75rem;
  padding: 0.75rem;
  outline: none;
}
.field {
  position: relative;
  flex: 1 1 auto;
  border: 1px solid var(--border);
  border-radius: 6px;
  background:
    linear-gradient(180deg, rgba(17, 22, 36, 0.55), rgba(10, 14, 26, 0.8)),
    repeating-linear-gradient(
      0deg,
      rgba(122, 162, 247, 0.04) 0,
      rgba(122, 162, 247, 0.04) 1px,
      transparent 1px,
      transparent 28px
    );
  overflow: hidden;
  box-shadow: inset 0 0 80px rgba(0, 0, 0, 0.5);
}
.field::before {
  content: '';
  position: absolute;
  inset: auto 0 0 0;
  height: 72px;
  background: linear-gradient(180deg, transparent, rgba(247, 118, 142, 0.18));
  pointer-events: none;
  border-top: 1px dashed rgba(247, 118, 142, 0.4);
}
.lane-grid {
  position: absolute;
  inset: 0;
  display: grid;
  gap: 6px;
  padding: 6px;
}
.lane {
  position: relative;
  border-radius: 4px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.01), rgba(122, 162, 247, 0.03));
  border: 1px solid rgba(122, 162, 247, 0.08);
  overflow: hidden;
}
.lane-guide {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    180deg,
    transparent 0,
    transparent 30px,
    rgba(122, 162, 247, 0.04) 30px,
    rgba(122, 162, 247, 0.04) 31px
  );
}
.card {
  position: absolute;
  top: -72px;
  left: 50%;
  transform: translateX(-50%);
  min-width: 160px;
  padding: 0.75rem 1.25rem;
  background: linear-gradient(180deg, #1a2340, #0e1423);
  border: 1px solid var(--accent);
  border-radius: 6px;
  color: var(--text);
  font-size: 1.8rem;
  font-weight: 600;
  text-align: center;
  letter-spacing: 0.03em;
  box-shadow:
    0 0 18px rgba(122, 162, 247, 0.2),
    inset 0 0 10px rgba(125, 207, 255, 0.08);
  transition: border-color 0.15s, box-shadow 0.15s, color 0.15s;
  will-change: top;
}
.card.target {
  border-color: var(--cyan);
  color: var(--cyan);
  box-shadow:
    0 0 28px rgba(125, 207, 255, 0.4),
    inset 0 0 14px rgba(125, 207, 255, 0.15);
}
.card.pr::after {
  content: 'PR!';
  position: absolute;
  top: -12px;
  right: -10px;
  padding: 2px 8px;
  background: var(--neon);
  color: #012;
  border-radius: 3px;
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  box-shadow: 0 0 12px var(--neon);
}
/* We need the inline transform (translateY) to NOT clobber centering.
   Work around with a wrapping approach: apply translateY via CSS var. */
.control-bar {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 1rem;
  padding: 0.6rem 1rem;
}
.control-bar .left {
  justify-self: start;
}
.control-bar .center {
  min-width: 280px;
}
.control-bar .right {
  justify-self: end;
  display: flex;
  gap: 0.5rem;
}
.answer {
  width: 100%;
  font-size: 1.6rem;
  text-align: center;
  letter-spacing: 0.1em;
  font-weight: 600;
  color: var(--cyan);
  background: var(--bg);
  border: 1px solid var(--accent);
  padding: 0.6rem 0.75rem;
  box-shadow: 0 0 14px rgba(122, 162, 247, 0.25);
}
.answer::placeholder {
  color: var(--text-muted);
  letter-spacing: 0.18em;
}
button.danger.armed {
  background: rgba(247, 118, 142, 0.15);
  border-color: var(--red);
  color: var(--red);
  box-shadow: 0 0 16px rgba(247, 118, 142, 0.35);
}
.diag {
  text-align: center;
  color: var(--text-muted);
}
.paused-overlay {
  position: absolute;
  inset: 0;
  background: rgba(10, 14, 26, 0.78);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  z-index: 20;
}
.paused-text {
  font-size: 3rem;
  letter-spacing: 0.2em;
  color: var(--yellow);
}
</style>
