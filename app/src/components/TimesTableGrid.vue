<script setup lang="ts">
import { computed } from 'vue';
import type { AnswerEvent } from '../types/answerEvent';
import { MISS_PENALTY_MS } from '../utils/scoring';

const props = defineProps<{ events: AnswerEvent[] }>();
const emit = defineEmits<{ 'cell-click': [{ a: number; b: number }] }>();

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
    if (e.is_correction) continue;
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

// Rank-based color: sort all present RPMs and color each cell by its
// percentile rank so one outlier can't collapse the whole scale.
const rpmRanks = computed((): Map<string, number> => {
  const entries: { a: number; b: number; rpm: number }[] = [];
  for (let a = 0; a <= 12; a++)
    for (let b = 0; b <= 12; b++) {
      const r = cells.value[a][b].rpm;
      if (r !== null) entries.push({ a, b, rpm: r });
    }
  entries.sort((x, y) => x.rpm - y.rpm);
  const ranks = new Map<string, number>();
  const n = entries.length;
  entries.forEach(({ a, b }, i) => ranks.set(`${a},${b}`, n === 1 ? 1 : i / (n - 1)));
  return ranks;
});

function cellColor(c: Cell): string {
  if (c.rpm === null) return 'rgba(255, 255, 255, 0.03)';
  const frac = rpmRanks.value.get(`${c.a},${c.b}`) ?? 0;
  // hue: 0 = red (worst/slowest), 130 = green (best/fastest).
  return `hsl(${Math.round(frac * 130)} 78% 55%)`;
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
            @click="emit('cell-click', { a: a - 1, b: b - 1 })"
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
  cursor: pointer;
}
.product {
  mix-blend-mode: multiply;
  font-size: 0.72rem;
}
</style>
