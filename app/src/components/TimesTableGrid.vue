<script setup lang="ts">
import { computed } from 'vue';
import type { AnswerEvent } from '../types/answerEvent';

const props = defineProps<{ events: AnswerEvent[] }>();

interface Cell {
  a: number;
  b: number;
  count: number;
  correct: number;
  medianMs: number;
}

function median(vals: number[]): number {
  if (vals.length === 0) return 0;
  const s = [...vals].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const cells = computed(() => {
  const grid: Cell[][] = [];
  for (let a = 0; a <= 12; a++) {
    grid[a] = [];
    for (let b = 0; b <= 12; b++) {
      grid[a][b] = { a, b, count: 0, correct: 0, medianMs: 0 };
    }
  }
  const bucket: number[][][] = Array.from({ length: 13 }, () =>
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
      bucket[a][b].push(e.response_time_ms);
    }
  }
  for (let a = 0; a <= 12; a++) {
    for (let b = 0; b <= 12; b++) {
      grid[a][b].medianMs = median(bucket[a][b]);
    }
  }
  return grid;
});

function cellColor(c: Cell): string {
  if (c.count === 0) return 'rgba(255,255,255,0.03)';
  const acc = c.correct / c.count;
  // hue: red (0) -> green (130)
  const hue = Math.round(acc * 130);
  // lightness: faster correct = brighter. medianMs 500→70% 6000→25%
  const lightness = c.medianMs === 0
    ? 25
    : Math.max(25, Math.min(70, 80 - (c.medianMs / 6000) * 55));
  return `hsl(${hue} 70% ${lightness}%)`;
}

function cellTitle(c: Cell): string {
  if (c.count === 0) return `${c.a} × ${c.b} — no data`;
  const acc = ((c.correct / c.count) * 100).toFixed(0);
  const med = c.medianMs ? `${Math.round(c.medianMs)} ms` : '—';
  return `${c.a} × ${c.b} = ${c.a * c.b}\n${c.correct}/${c.count} correct (${acc}%)\nmedian ${med}`;
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
  color: rgba(10, 14, 26, 0.8);
  font-weight: 600;
  position: relative;
  cursor: default;
}
.product {
  mix-blend-mode: multiply;
  font-size: 0.72rem;
}
</style>
