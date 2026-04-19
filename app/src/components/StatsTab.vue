<script setup lang="ts">
import { computed, ref } from 'vue';
import { useSessionStore } from '../stores/sessionStore';
import TimesTableGrid from './TimesTableGrid.vue';
import CardHistoryBars from './CardHistoryBars.vue';
import { geometricMean } from '../utils/scoring';
import { TIME_WINDOWS, WINDOW_LABELS, filterByWindow } from '../utils/timeWindow';
import type { TimeWindow } from '../utils/timeWindow';
import type { AnswerEvent } from '../types/answerEvent';

const session = useSessionStore();

// ── Time window ───────────────────────────────────────────────────────────────
const win = ref<TimeWindow>('all');

const filtered = computed((): AnswerEvent[] =>
  filterByWindow(session.combinedHistory, win.value, session.history),
);

// ── Cell selection ────────────────────────────────────────────────────────────
const selectedCell = ref<{ a: number; b: number } | null>(null);

const selectedCellEvents = computed((): AnswerEvent[] => {
  if (!selectedCell.value) return [];
  const { a, b } = selectedCell.value;
  return session.combinedHistory.filter(
    (e) => e.question.operandA === a && e.question.operandB === b,
  );
});

function onCellClick(cell: { a: number; b: number }) {
  if (selectedCell.value?.a === cell.a && selectedCell.value?.b === cell.b) {
    selectedCell.value = null;
  } else {
    selectedCell.value = cell;
  }
}

// ── Summary stats ─────────────────────────────────────────────────────────────
const totalCount   = computed(() => filtered.value.length);
const correctCount = computed(
  () => filtered.value.filter((e) => e.is_correct && !e.is_timeout).length,
);
const accuracy = computed(() =>
  totalCount.value === 0
    ? '—'
    : ((correctCount.value / totalCount.value) * 100).toFixed(1) + '%',
);
const TOTAL_CELLS = 169; // 13 × 13

const coverageStats = computed(() => {
  const counts = new Map<string, number>();
  for (const e of filtered.value) {
    if (e.is_correction) continue;
    const { operandA: a, operandB: b } = e.question;
    if (a >= 0 && a <= 12 && b >= 0 && b <= 12) {
      const key = `${a},${b}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const seenCount = counts.size;
  let totalRepeats = 0;
  let repeatedCards = 0;
  for (const n of counts.values()) {
    if (n > 1) { totalRepeats += n - 1; repeatedCards++; }
  }
  return {
    seenCount,
    totalRepeats,
    repeatedCards,
    pct: Math.round((seenCount / TOTAL_CELLS) * 100),
  };
});

const avgRpm = computed(() => {
  const arr = filtered.value.filter((e) => e.is_correct && !e.is_timeout);
  if (arr.length === 0) return '—';
  const gmMs = geometricMean(arr.map((e) => Math.max(1, e.response_time_ms)));
  if (gmMs <= 0) return '—';
  return (60_000 / gmMs).toFixed(1) + ' RPM';
});
</script>

<template>
  <div class="stats">
    <div class="header panel">
      <div class="title mono-caps">Telemetry</div>
      <div class="filters">
        <button
          v-for="w in TIME_WINDOWS"
          :key="w"
          class="win-btn"
          :class="{ active: win === w }"
          :data-testid="`win-${w}`"
          @click="win = w"
        >{{ WINDOW_LABELS[w] }}</button>
      </div>
      <div class="kpis">
        <div class="kpi">
          <span class="mono-caps">Answers</span>
          <span class="v">{{ totalCount }}</span>
        </div>
        <div class="kpi">
          <span class="mono-caps">Accuracy</span>
          <span class="v">{{ accuracy }}</span>
        </div>
        <div class="kpi">
          <span class="mono-caps">Avg Rate</span>
          <span class="v">{{ avgRpm }}</span>
        </div>
      </div>
    </div>

    <div class="coverage-bar mono-caps">
      <span class="seen">{{ coverageStats.seenCount }} / {{ TOTAL_CELLS }} ({{ coverageStats.pct }}%) seen</span>
      <template v-if="coverageStats.totalRepeats > 0">
        <span class="sep">·</span>
        <span class="repeats">
          {{ coverageStats.totalRepeats }} repeat{{ coverageStats.totalRepeats === 1 ? '' : 's' }}
          on {{ coverageStats.repeatedCards }} different card{{ coverageStats.repeatedCards === 1 ? '' : 's' }}
        </span>
      </template>
    </div>

    <div class="grid-area">
      <TimesTableGrid :events="filtered" @cell-click="onCellClick" />
    </div>

    <div
      v-if="selectedCell && selectedCellEvents.length > 0"
      class="cell-history panel"
      data-testid="cell-history"
    >
      <div class="cell-title">
        <span class="cell-expr mono-caps">
          {{ selectedCell.a }} × {{ selectedCell.b }} = {{ selectedCell.a * selectedCell.b }}
        </span>
        <span class="cell-count mono-caps">
          {{ selectedCellEvents.length }} attempt{{ selectedCellEvents.length === 1 ? '' : 's' }}
        </span>
        <button class="close-btn" @click="selectedCell = null">✕</button>
      </div>
      <CardHistoryBars
        :events="selectedCellEvents"
        :session-start-timestamp="session.sessionStart"
      />
    </div>
  </div>
</template>

<style scoped>
.stats {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem;
  height: 100%;
  overflow: auto;
}
.header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 0.65rem 1rem;
}
.title { color: var(--accent); }
.filters { display: flex; gap: 0.3rem; }
.win-btn { padding: 0.3rem 0.65rem; font-size: 0.7rem; }
.win-btn.active {
  border-color: var(--cyan);
  color: var(--cyan);
  background: var(--bg-raised);
}
.kpis { display: flex; gap: 1.25rem; margin-left: auto; }
.kpi  { display: flex; flex-direction: column; gap: 0.2rem; align-items: flex-end; }
.kpi .v { font-size: 1.1rem; font-weight: 600; color: var(--cyan); }
.coverage-bar {
  display: flex;
  gap: 0.4rem;
  align-items: baseline;
  font-size: 0.68rem;
  padding: 0 0.25rem;
}
.seen    { color: var(--cyan); }
.repeats { color: var(--text-muted); }
.sep     { color: var(--text-dim); }
.grid-area { display: flex; }
.cell-history {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.75rem 1rem;
}
.cell-title {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
}
.cell-expr { color: var(--cyan); font-size: 0.82rem; }
.cell-count { color: var(--text-muted); font-size: 0.72rem; }
.close-btn {
  margin-left: auto;
  padding: 0.1rem 0.4rem;
  font-size: 0.65rem;
  color: var(--text-dim);
  background: none;
  border: 1px solid var(--border);
}
.close-btn:hover { color: var(--text); border-color: var(--text-dim); }
</style>
