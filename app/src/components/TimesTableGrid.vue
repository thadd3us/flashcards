<script setup lang="ts">
import { computed } from 'vue';
import type { AnswerEvent } from '../types/answerEvent';
import { MISS_PENALTY_MS } from '../utils/scoring';

const props = defineProps<{ events: AnswerEvent[] }>();

interface Cell {
  a: number;
  b: number;
  count: number;
  correct: number;
  // Geometric mean of response times in ms (wrongs penalized with
  // MISS_PENALTY_MS), converted to RPM. Composite quality signal.
  rpm: number | null;
}

const cells = computed(() => {
  const grid: Cell[][] = Array.from({ length: 13 }, (_, a) =>
    Array.from({ length: 13 }, (_, b) => ({ a, b, count: 0, correct: 0, rpm: null as number | null })),
  );
  const timesByCell: number[][][] = Array.from({ length: 13 }, () =>
    Array.from({ length: 13 }, () => []),
  );
  for (const e of props.events) {
    const a = e.question.operandA;
    const b = e.question.operandB;
    if (a < 0 || a > 12 || b < 0 || b > 12) continue;
    const c = grid[a][b];
    c.count++;
    if (e.is_correct && !e.is_timeout) {
      c.correct++;
      timesByCell[a][b].push(Math.max(1, e.response_time_ms));
    } else {
      timesByCell[a][b].push(MISS_PENALTY_MS);
    }
  }
  for (let a = 0; a <= 12; a++) {
    for (let b = 0; b <= 12; b++) {
      const times = timesByCell[a][b];
      if (times.length === 0) continue;
      const logSum = times.reduce((s, t) => s + Math.log(t), 0);
      const gmMs = Math.exp(logSum / times.length);
      grid[a][b].rpm = 60_000 / gmMs;
    }
  }
  return grid;
});

// Normalize the color gradient against the range actually present in the
// data — so the *worst* cell is always pure red, not some washed-out amber.
const scoreRange = computed(() => {
  const scores: number[] = [];
  for (let a = 0; a <= 12; a++) {
    for (let b = 0; b <= 12; b++) {
      const r = cells.value[a][b].rpm;
      if (r !== null) scores.push(r);
    }
  }
  if (scores.length === 0) return { min: 0, max: 1 };
  return { min: Math.min(...scores), max: Math.max(...scores) };
});

function cellColor(c: Cell): string {
  if (c.rpm === null) return 'rgba(255, 255, 255, 0.03)';
  const { min, max } = scoreRange.value;
  const frac = max === min ? 1 : (c.rpm - min) / (max - min);
  // hue: 0 = red (worst), 130 = green (best).
  const hue = Math.round(frac * 130);
  return `hsl(${hue} 78% 55%)`;
}

function cellTitle(c: Cell): string {
  if (c.count === 0) return `${c.a} × ${c.b} — no data`;
  const acc = ((c.correct / c.count) * 100).toFixed(0);
  const rpm = c.rpm !== null ? `${c.rpm.toFixed(1)} RPM` : '—';
  return `${c.a} × ${c.b} = ${c.a * c.b}\n${c.correct}/${c.count} correct (${acc}%)\nGM ${rpm}`;
}
</script>

<template>
  <div class="grid-wrap" data-testid="times-grid">
    <table class="grid">
      <thead>
        <tr>
          <th class="corner">×</th>
          <th v-for="b in 13" :key="'h' + b" class="header">{{ b - 1 }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="a in 13" :key="'r' + a">
          <th class="header">{{ a - 1 }}</th>
          <td
            v-for="b in 13"
            :key="'c' + a + '-' + b"
            class="cell"
            :style="{ background: cellColor(cells[a - 1][b - 1]) }"
            :title="cellTitle(cells[a - 1][b - 1])"
          >
            <span class="product">{{ (a - 1) * (b - 1) }}</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.grid-wrap {
  display: inline-block;
  padding: 0.5rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-panel);
}
.grid {
  border-collapse: separate;
  border-spacing: 2px;
  font-size: 0.7rem;
}
.corner,
.header {
  background: transparent;
  color: var(--text-dim);
  font-weight: 500;
  width: 34px;
  height: 34px;
  text-align: center;
  letter-spacing: 0.05em;
}
.cell {
  width: 34px;
  height: 34px;
  text-align: center;
  border-radius: 3px;
  color: rgba(10, 14, 26, 0.85);
  font-weight: 600;
  position: relative;
  cursor: default;
}
.product {
  mix-blend-mode: multiply;
  font-size: 0.72rem;
}
</style>
