<script setup lang="ts">
import { computed, ref } from 'vue';
import { useSessionStore } from '../stores/sessionStore';
import TimesTableGrid from './TimesTableGrid.vue';
import CdfPlot from './CdfPlot.vue';
import type { AnswerEvent } from '../types/answerEvent';

const session = useSessionStore();

type Window = 'session' | 'day' | 'week' | 'month' | 'all';
type CompareWindow = 'day' | 'week' | 'month';

const win = ref<Window>('all');
const compare = ref(false);
const compareWin = ref<CompareWindow>('day');

const windowMs: Record<CompareWindow, number> = {
  day: 24 * 3600_000,
  week: 7 * 24 * 3600_000,
  month: 30 * 24 * 3600_000,
};

function filterBy(events: AnswerEvent[], from: number, to: number): AnswerEvent[] {
  return events.filter((e) => {
    const t = Date.parse(e.timestamp);
    return !Number.isNaN(t) && t >= from && t < to;
  });
}

function filterEvents(): AnswerEvent[] {
  const now = Date.now();
  if (win.value === 'session') return session.history;
  if (win.value === 'all') return session.combinedHistory;
  const ms =
    win.value === 'day'
      ? windowMs.day
      : win.value === 'week'
        ? windowMs.week
        : windowMs.month;
  return filterBy(session.combinedHistory, now - ms, now + 1);
}

const filtered = computed(filterEvents);

const compareRanges = computed(() => {
  const now = Date.now();
  const ms = windowMs[compareWin.value];
  return {
    current: { from: now - ms, to: now + 1, label: `Last ${compareWin.value}` },
    prior: {
      from: now - 2 * ms,
      to: now - ms,
      label: `Prior ${compareWin.value}`,
    },
  };
});

const currentEvents = computed(() =>
  filterBy(
    session.combinedHistory,
    compareRanges.value.current.from,
    compareRanges.value.current.to,
  ),
);
const priorEvents = computed(() =>
  filterBy(
    session.combinedHistory,
    compareRanges.value.prior.from,
    compareRanges.value.prior.to,
  ),
);

const compareCurves = computed(() => [
  {
    label: `Now (${compareRanges.value.current.label})`,
    events: currentEvents.value,
    tone: 'cyan' as const,
  },
  {
    label: `Then (${compareRanges.value.prior.label})`,
    events: priorEvents.value,
    tone: 'accent2' as const,
  },
]);

const correctCount = computed(
  () => filtered.value.filter((e) => e.is_correct && !e.is_timeout).length,
);
const totalCount = computed(() => filtered.value.length);
const accuracy = computed(() =>
  totalCount.value === 0
    ? '—'
    : ((correctCount.value / totalCount.value) * 100).toFixed(1) + '%',
);
const avgMs = computed(() => {
  const arr = filtered.value.filter((e) => e.is_correct && !e.is_timeout);
  if (arr.length === 0) return '—';
  return (
    Math.round(arr.reduce((a, e) => a + e.response_time_ms, 0) / arr.length) + ' ms'
  );
});
</script>

<template>
  <div class="stats">
    <div class="header panel">
      <div class="title mono-caps">Telemetry</div>
      <div class="filters">
        <button
          v-for="w in ['session', 'day', 'week', 'month', 'all'] as const"
          :key="w"
          class="win-btn"
          :class="{ active: win === w }"
          :data-testid="`win-${w}`"
          @click="win = w"
        >
          {{ w }}
        </button>
      </div>
      <div class="kpis">
        <div class="kpi">
          <span class="mono-caps">Answers</span><span class="v">{{ totalCount }}</span>
        </div>
        <div class="kpi">
          <span class="mono-caps">Accuracy</span><span class="v">{{ accuracy }}</span>
        </div>
        <div class="kpi">
          <span class="mono-caps">Avg Time</span><span class="v">{{ avgMs }}</span>
        </div>
      </div>
    </div>
    <div class="row">
      <TimesTableGrid :events="filtered" />
      <div class="cdf-col">
        <div class="cdf-head panel">
          <span class="mono-caps">Response Time CDF</span>
          <div class="compare-toggle">
            <button
              class="win-btn"
              :class="{ active: !compare }"
              data-testid="cdf-mode-single"
              @click="compare = false"
            >
              Single
            </button>
            <button
              class="win-btn"
              :class="{ active: compare }"
              data-testid="cdf-mode-compare"
              @click="compare = true"
            >
              Now vs Then
            </button>
          </div>
          <div v-if="compare" class="compare-win">
            <button
              v-for="w in ['day', 'week', 'month'] as const"
              :key="w"
              class="win-btn"
              :class="{ active: compareWin === w }"
              :data-testid="`cmp-${w}`"
              @click="compareWin = w"
            >
              vs last {{ w }}
            </button>
          </div>
        </div>
        <CdfPlot
          v-if="!compare"
          :events="filtered"
        />
        <CdfPlot
          v-else
          :curves="compareCurves"
          :wrongs-as-tail="true"
        />
      </div>
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
  gap: 1rem;
  padding: 0.75rem 1rem;
}
.title {
  color: var(--accent);
}
.filters {
  display: flex;
  gap: 0.3rem;
  flex: 1;
}
.win-btn {
  padding: 0.3rem 0.7rem;
  font-size: 0.7rem;
}
.win-btn.active {
  border-color: var(--cyan);
  color: var(--cyan);
  background: var(--bg-raised);
}
.kpis {
  display: flex;
  gap: 1.25rem;
}
.kpi {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  align-items: flex-end;
}
.kpi .v {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--cyan);
}
.row {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: flex-start;
}
.cdf-col {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 560px;
  flex: 1 1 560px;
}
.cdf-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  padding: 0.5rem 0.75rem;
}
.compare-toggle,
.compare-win {
  display: flex;
  gap: 0.3rem;
}
</style>
