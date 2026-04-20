<script setup lang="ts">
import { computed } from 'vue';
import type { AnswerEvent } from '../types/answerEvent';
import { MISS_PENALTY_MS } from '../utils/scoring';

const props = defineProps<{
  events: AnswerEvent[];
}>();

const GRID = 13;

interface CellData {
  count: number;
  rpm: number | null;
}

const cells = computed((): CellData[][] => {
  const grid: CellData[][] = Array.from({ length: GRID }, () =>
    Array.from({ length: GRID }, () => ({ count: 0, rpm: null })),
  );
  const times: number[][][] = Array.from({ length: GRID }, () =>
    Array.from({ length: GRID }, () => []),
  );
  for (const e of props.events) {
    if (e.is_correction) continue;
    const a = e.question.operandA;
    const b = e.question.operandB;
    if (a < 0 || a >= GRID || b < 0 || b >= GRID) continue;
    grid[a][b].count++;
    times[a][b].push(
      e.is_correct && !e.is_timeout ? Math.max(1, e.response_time_ms) : MISS_PENALTY_MS,
    );
  }
  for (let a = 0; a < GRID; a++) {
    for (let b = 0; b < GRID; b++) {
      const ts = times[a][b];
      if (ts.length === 0) continue;
      const logSum = ts.reduce((s, t) => s + Math.log(t), 0);
      grid[a][b].rpm = 60_000 / Math.exp(logSum / ts.length);
    }
  }
  return grid;
});

const rpmRanks = computed((): Map<string, number> => {
  const entries: { a: number; b: number; rpm: number }[] = [];
  for (let a = 0; a < GRID; a++)
    for (let b = 0; b < GRID; b++) {
      const r = cells.value[a][b].rpm;
      if (r !== null) entries.push({ a, b, rpm: r });
    }
  entries.sort((x, y) => x.rpm - y.rpm);
  const ranks = new Map<string, number>();
  const n = entries.length;
  entries.forEach(({ a, b }, i) => ranks.set(`${a},${b}`, n === 1 ? 1 : i / (n - 1)));
  return ranks;
});

function cellColor(a: number, b: number): string {
  const c = cells.value[a][b];
  if (c.rpm === null) return 'rgba(255,255,255,0.05)';
  const frac = rpmRanks.value.get(`${a},${b}`) ?? 0;
  return `hsl(${Math.round(frac * 130)} 70% 40%)`;
}

function cellTitle(a: number, b: number): string {
  const c = cells.value[a][b];
  if (c.count === 0) return `${a} × ${b} — unseen`;
  return `${a} × ${b} — ${c.count} answer${c.count === 1 ? '' : 's'}`;
}
</script>

<template>
  <div class="mini-grid">
    <div class="hdr corner" />
    <div v-for="b in GRID" :key="'h' + b" class="hdr">{{ b - 1 }}</div>
    <template v-for="a in GRID" :key="'r' + a">
      <div class="hdr">{{ a - 1 }}</div>
      <div
        v-for="b in GRID"
        :key="'c' + a + b"
        class="cell"
        :style="{ background: cellColor(a - 1, b - 1) }"
        :title="cellTitle(a - 1, b - 1)"
      />
    </template>
  </div>
</template>

<style scoped>
.mini-grid {
  display: grid;
  grid-template-columns: 14px repeat(13, 1fr);
  gap: 1px;
}
.hdr {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-dim);
  font-size: 0.45rem;
  line-height: 1;
}
.cell {
  aspect-ratio: 1;
  border-radius: 1px;
}
</style>
