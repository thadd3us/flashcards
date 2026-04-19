<script setup lang="ts">
import { computed, ref } from 'vue';
import type { AnswerEvent } from '../types/answerEvent';

const props = defineProps<{
  events: AnswerEvent[];             // all events for this question, any order
  sessionStartTimestamp: string | null; // current session start ISO string
  limit?: number;                    // if set, only show the last N events
}>();

const H = 108;
const PAD_X = 10;
const PAD_Y = 10;
const BAR_GAP = 3;
const PLOT_H = H - PAD_Y * 2;

const sorted = computed(() =>
  [...props.events]
    .filter((e) => !e.is_correction)
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)),
);

const shown = computed(() =>
  props.limit ? sorted.value.slice(-props.limit) : sorted.value,
);

function rpmFor(e: AnswerEvent): number {
  if (!e.is_correct || e.is_timeout) return 0;
  return 60_000 / Math.max(1, e.response_time_ms);
}

const maxRpm = computed(() => {
  const rpms = shown.value.map(rpmFor).filter((r) => r > 0);
  return rpms.length > 0 ? Math.max(...rpms) * 1.1 : 60;
});

// Percentile of the last shown event within all correct answers for this question.
const lastPercentile = computed((): number | null => {
  const last = shown.value[shown.value.length - 1];
  if (!last) return null;
  if (!last.is_correct || last.is_timeout) return 0;
  const lastRpm = rpmFor(last);
  const peers = props.events.filter(
    (e) => e !== last && e.is_correct && !e.is_timeout,
  );
  if (peers.length === 0) return 1.0;
  return peers.filter((e) => rpmFor(e) < lastRpm).length / peers.length;
});

function percentileHsl(pct: number): string {
  return `hsl(${Math.round(pct * 120)} 78% 55%)`;
}

function barColor(e: AnswerEvent, idx: number, isLast: boolean): string {
  if (isLast) {
    const pct = lastPercentile.value ?? 0;
    return percentileHsl(pct);
  }
  // Current session = blue; past sessions = gray gradient by recency.
  const isCurrent =
    props.sessionStartTimestamp != null &&
    e.session_start_timestamp === props.sessionStartTimestamp;
  if (isCurrent) return 'rgba(122, 162, 247, 0.65)';
  const n = shown.value.length;
  const recency = n <= 2 ? 1 : idx / (n - 2);
  const opacity = 0.15 + recency * 0.35;
  return `rgba(192, 202, 245, ${opacity.toFixed(2)})`;
}

const barWidth = computed(() => {
  const n = shown.value.length;
  if (n === 0) return 12;
  const available = 360 - PAD_X * 2;
  return Math.max(5, Math.min(20, Math.floor((available - (n - 1) * BAR_GAP) / n)));
});

const svgWidth = computed(() => {
  const n = shown.value.length;
  return PAD_X * 2 + Math.max(0, n * (barWidth.value + BAR_GAP) - BAR_GAP);
});

const bars = computed(() => {
  const n = shown.value.length;
  return shown.value.map((e, idx) => {
    const rpm = rpmFor(e);
    const frac = rpm > 0 ? rpm / maxRpm.value : 0;
    const h = Math.max(2, frac * PLOT_H);
    const x = PAD_X + idx * (barWidth.value + BAR_GAP);
    const y = H - PAD_Y - h;
    const isLast = idx === n - 1;
    return { e, x, y, h, isLast, color: barColor(e, idx, isLast) };
  });
});

const hover = ref<{ e: AnswerEvent; x: number; pct: number | null } | null>(null);

function onMouseover(e: AnswerEvent, x: number, isLast: boolean) {
  const pct = isLast ? lastPercentile.value : null;
  hover.value = { e, x, pct };
}

function fmtTs(ts: string): string {
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

function fmtRpm(e: AnswerEvent): string {
  if (!e.is_correct || e.is_timeout) return 'Wrong / Miss';
  return `${rpmFor(e).toFixed(1)} RPM`;
}
</script>

<template>
  <div class="bars-outer">
    <div v-if="shown.length === 0" class="empty mono-caps">No history yet</div>
    <div v-else class="bars-scroll">
      <svg
        :viewBox="`0 0 ${svgWidth} ${H}`"
        :width="svgWidth"
        :height="H"
        class="bars-svg"
        @mouseleave="hover = null"
      >
        <!-- baseline -->
        <line
          :x1="PAD_X" :y1="H - PAD_Y"
          :x2="svgWidth - PAD_X" :y2="H - PAD_Y"
          stroke="rgba(192,202,245,0.15)" stroke-width="1"
        />
        <!-- bars -->
        <rect
          v-for="b in bars"
          :key="b.e.uuid"
          :x="b.x" :y="b.y" :width="barWidth" :height="b.h"
          :fill="b.color"
          rx="2"
          @mouseover="onMouseover(b.e, b.x + barWidth / 2, b.isLast)"
        />
        <!-- hover crosshair -->
        <line
          v-if="hover"
          :x1="hover.x" :y1="PAD_Y"
          :x2="hover.x" :y2="H - PAD_Y"
          stroke="rgba(192,202,245,0.35)" stroke-dasharray="2 2" stroke-width="1"
        />
      </svg>
    </div>

    <div v-if="hover" class="bar-tooltip">
      <span>{{ fmtRpm(hover.e) }}</span>
      <span v-if="hover.pct !== null" :style="{ color: percentileHsl(hover.pct) }">
        {{ Math.round(hover.pct * 100) }}th pct
      </span>
      <span class="ts">{{ fmtTs(hover.e.timestamp) }}</span>
    </div>
  </div>
</template>

<style scoped>
.bars-outer {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.bars-scroll {
  overflow-x: auto;
}
.bars-svg {
  display: block;
}
.empty {
  color: var(--text-muted);
  font-size: 0.72rem;
  padding: 0.5rem 0;
}
.bar-tooltip {
  display: flex;
  gap: 0.6rem;
  align-items: baseline;
  font-size: 0.75rem;
  color: var(--text);
  padding: 0.2rem 0;
}
.ts {
  color: var(--text-dim);
  font-size: 0.68rem;
}
</style>
