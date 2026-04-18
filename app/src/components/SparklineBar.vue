<script setup lang="ts">
import { computed } from 'vue';
import { useSessionStore } from '../stores/sessionStore';

const session = useSessionStore();

const WIDTH = 220;
const HEIGHT = 36;
const PAD = 2;

const path = computed(() => {
  const data = session.scoreHistory;
  if (data.length === 0) return '';
  const max = Math.max(...data, 0.001);
  const min = Math.min(...data);
  const span = Math.max(0.001, max - min);
  const n = data.length;
  const pts = data.map((v, i) => {
    const x = n === 1 ? WIDTH / 2 : PAD + (i / (n - 1)) * (WIDTH - PAD * 2);
    const y = HEIGHT - PAD - ((v - min) / span) * (HEIGHT - PAD * 2);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  return 'M' + pts.join(' L');
});

const scoreFmt = computed(() => session.currentProficiency.toFixed(1));
</script>

<template>
  <div class="sparkline" data-testid="sparkline">
    <div class="label">
      <span class="mono-caps">Proficiency · RPM</span>
      <span class="value glow">{{ scoreFmt }}</span>
    </div>
    <svg :width="WIDTH" :height="HEIGHT" class="spark" role="img">
      <defs>
        <linearGradient id="sparkFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#7dcfff" stop-opacity="0.55" />
          <stop offset="100%" stop-color="#7dcfff" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path v-if="path" :d="path" class="spark-line" />
    </svg>
  </div>
</template>

<style scoped>
.sparkline {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.25rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: rgba(17, 22, 36, 0.8);
}
.label {
  display: flex;
  flex-direction: column;
  line-height: 1;
  gap: 0.25rem;
}
.value {
  color: var(--cyan);
  font-size: 1.1rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}
.spark-line {
  fill: none;
  stroke: var(--cyan);
  stroke-width: 1.6;
  filter: drop-shadow(0 0 4px rgba(125, 207, 255, 0.55));
}
</style>
