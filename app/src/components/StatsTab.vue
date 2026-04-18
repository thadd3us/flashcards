<script setup lang="ts">
import { computed, ref } from 'vue';
import { useSessionStore } from '../stores/sessionStore';
import TimesTableGrid from './TimesTableGrid.vue';
import CdfPlot from './CdfPlot.vue';

const session = useSessionStore();

type Window = 'session' | 'day' | 'week' | 'month' | 'all';
const win = ref<Window>('all');

function filterEvents() {
  const now = Date.now();
  const all = session.combinedHistory;
  const sessionStart = session.sessionStart ? Date.parse(session.sessionStart) : now;
  if (win.value === 'session') {
    return session.history;
  }
  if (win.value === 'all') return all;
  const cutoffs: Record<Window, number> = {
    session: sessionStart,
    day: now - 24 * 3600e3,
    week: now - 7 * 24 * 3600e3,
    month: now - 30 * 24 * 3600e3,
    all: 0,
  };
  const cutoff = cutoffs[win.value];
  return all.filter((e) => {
    const t = Date.parse(e.timestamp);
    return !Number.isNaN(t) && t >= cutoff;
  });
}

const filtered = computed(filterEvents);

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
  return Math.round(arr.reduce((a, e) => a + e.response_time_ms, 0) / arr.length) + ' ms';
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
      <CdfPlot :events="filtered" />
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
</style>
