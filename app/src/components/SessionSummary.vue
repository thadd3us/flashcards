<script setup lang="ts">
import { computed } from 'vue';
import { useSessionStore } from '../stores/sessionStore';
import { geometricMean } from '../utils/scoring';

const session = useSessionStore();

const events = computed(() => session.history);
const correct = computed(
  () => events.value.filter((e) => e.is_correct && !e.is_timeout).length,
);
const total = computed(() => events.value.length);
const avgRpm = computed(() => {
  const c = events.value.filter((e) => e.is_correct && !e.is_timeout);
  if (c.length === 0) return '—';
  const gmMs = geometricMean(c.map((e) => Math.max(1, e.response_time_ms)));
  if (gmMs <= 0) return '—';
  return (60_000 / gmMs).toFixed(1);
});
const slowest = computed(() => {
  const c = events.value.filter((e) => e.is_correct && !e.is_timeout);
  if (c.length === 0) return null;
  return c.reduce((a, b) => (a.response_time_ms > b.response_time_ms ? a : b));
});
const bestCombo = computed(() => session.bestCombo);
const proficiency = computed(() => session.currentProficiency.toFixed(1));
</script>

<template>
  <div class="overlay">
    <div class="panel modal">
      <div class="mono-caps">Session Summary</div>
      <h1 class="glow">{{ session.username ?? 'Operator' }}</h1>
      <div class="stats">
        <div class="stat">
          <span class="mono-caps">Proficiency (RPM)</span><span class="v">{{ proficiency }}</span>
        </div>
        <div class="stat">
          <span class="mono-caps">Answers</span><span class="v">{{ total }}</span>
        </div>
        <div class="stat">
          <span class="mono-caps">Correct</span><span class="v">{{ correct }}</span>
        </div>
        <div class="stat">
          <span class="mono-caps">Avg Rate (RPM)</span><span class="v">{{ avgRpm }}</span>
        </div>
        <div class="stat">
          <span class="mono-caps">Best Combo</span><span class="v">×{{ bestCombo }}</span>
        </div>
        <div class="stat">
          <span class="mono-caps">Slowest</span>
          <span class="v">
            {{ slowest ? slowest.question.content : '—' }}
          </span>
        </div>
      </div>
      <button class="primary big" @click="session.dismissSessionSummary()">Dismiss</button>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(10, 14, 26, 0.88);
  display: grid;
  place-items: center;
  z-index: 90;
}
.modal {
  width: min(520px, 92vw);
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
h1 {
  margin: 0;
  color: var(--accent);
  font-size: 1.6rem;
}
.stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem 1.25rem;
}
.stat {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  border-left: 2px solid var(--accent);
  padding-left: 0.75rem;
}
.stat .v {
  font-size: 1.1rem;
  color: var(--cyan);
}
.big {
  padding: 0.75rem;
}
</style>
