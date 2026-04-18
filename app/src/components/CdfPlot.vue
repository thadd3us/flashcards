<script setup lang="ts">
import { computed, ref } from 'vue';
import type { AnswerEvent } from '../types/answerEvent';

const props = defineProps<{ events: AnswerEvent[] }>();

const W = 560;
const H = 260;
const PAD_L = 50;
const PAD_R = 20;
const PAD_T = 16;
const PAD_B = 36;

interface Point {
  x: number;
  y: number;
  ms: number;
  event: AnswerEvent;
}

function makeCurve(list: AnswerEvent[], xMax: number) {
  const sorted = [...list].sort((a, b) => a.response_time_ms - b.response_time_ms);
  const pts: Point[] = [];
  const y0 = H - PAD_B;
  if (sorted.length > 0) {
    pts.push({ x: PAD_L, y: y0, ms: 0, event: sorted[0] });
  }
  sorted.forEach((e, i) => {
    const frac = (i + 1) / sorted.length;
    const x = PAD_L + Math.min(1, e.response_time_ms / xMax) * (W - PAD_L - PAD_R);
    const y = H - PAD_B - frac * (H - PAD_T - PAD_B);
    // step: horizontal then vertical
    pts.push({ x, y: y0 - ((i) / sorted.length) * (H - PAD_T - PAD_B), ms: e.response_time_ms, event: e });
    pts.push({ x, y, ms: e.response_time_ms, event: e });
  });
  if (sorted.length > 0) {
    // trailing horizontal to the right edge
    pts.push({ x: W - PAD_R, y: PAD_T + (H - PAD_T - PAD_B) * 0, ms: xMax, event: sorted[sorted.length - 1] });
  }
  return pts;
}

const xMax = computed(() => {
  const all = props.events.map((e) => e.response_time_ms);
  if (all.length === 0) return 6_000;
  const sorted = [...all].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 6_000;
  return Math.max(2_000, Math.min(15_000, p95 * 1.25));
});

const correctPts = computed(() =>
  makeCurve(
    props.events.filter((e) => e.is_correct && !e.is_timeout),
    xMax.value,
  ),
);
const wrongPts = computed(() =>
  makeCurve(
    props.events.filter((e) => !e.is_correct || e.is_timeout),
    xMax.value,
  ),
);

function path(pts: Point[]): string {
  if (pts.length === 0) return '';
  return 'M' + pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L');
}

const hover = ref<Point | null>(null);
const svgRef = ref<SVGSVGElement | null>(null);

function onMove(e: MouseEvent) {
  const all = [...correctPts.value, ...wrongPts.value];
  if (all.length === 0) return;
  const rect = (svgRef.value!).getBoundingClientRect();
  const mx = ((e.clientX - rect.left) / rect.width) * W;
  const my = ((e.clientY - rect.top) / rect.height) * H;
  let best: Point | null = null;
  let bestD = Infinity;
  for (const p of all) {
    const d = (p.x - mx) ** 2 + (p.y - my) ** 2;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  hover.value = bestD < 400 ? best : null;
}

function ticksX(): number[] {
  const step = xMax.value > 8000 ? 2000 : 1000;
  const out: number[] = [];
  for (let v = 0; v <= xMax.value; v += step) out.push(v);
  return out;
}
</script>

<template>
  <div class="cdf-wrap">
    <div class="legend">
      <span class="sw correct"></span>
      <span class="label">Correct</span>
      <span class="sw wrong"></span>
      <span class="label">Wrong / Miss</span>
    </div>
    <svg
      ref="svgRef"
      :viewBox="`0 0 ${W} ${H}`"
      class="cdf"
      @mousemove="onMove"
      @mouseleave="hover = null"
    >
      <!-- grid -->
      <g class="grid">
        <line v-for="v in [0, 0.25, 0.5, 0.75, 1]" :key="v"
          :x1="PAD_L"
          :x2="W - PAD_R"
          :y1="H - PAD_B - v * (H - PAD_T - PAD_B)"
          :y2="H - PAD_B - v * (H - PAD_T - PAD_B)"
        />
        <line v-for="t in ticksX()" :key="'x' + t"
          :x1="PAD_L + (t / xMax) * (W - PAD_L - PAD_R)"
          :x2="PAD_L + (t / xMax) * (W - PAD_L - PAD_R)"
          :y1="PAD_T"
          :y2="H - PAD_B"
        />
      </g>

      <!-- axes -->
      <g class="axes">
        <line :x1="PAD_L" :y1="H - PAD_B" :x2="W - PAD_R" :y2="H - PAD_B" />
        <line :x1="PAD_L" :y1="PAD_T" :x2="PAD_L" :y2="H - PAD_B" />
        <text
          v-for="t in ticksX()" :key="'tx' + t"
          :x="PAD_L + (t / xMax) * (W - PAD_L - PAD_R)"
          :y="H - PAD_B + 14"
          text-anchor="middle"
        >{{ (t / 1000).toFixed(1) }}s</text>
        <text v-for="v in [0, 0.25, 0.5, 0.75, 1]" :key="'ty' + v"
          :x="PAD_L - 8"
          :y="H - PAD_B - v * (H - PAD_T - PAD_B) + 4"
          text-anchor="end"
        >{{ Math.round(v * 100) }}%</text>
      </g>

      <path class="curve correct" :d="path(correctPts)" />
      <path class="curve wrong" :d="path(wrongPts)" />

      <g v-if="hover">
        <line class="hover-line" :x1="hover.x" :x2="hover.x" :y1="PAD_T" :y2="H - PAD_B" />
        <circle :cx="hover.x" :cy="hover.y" r="4" class="hover-dot" />
      </g>
    </svg>

    <div class="tooltip" v-if="hover">
      <div class="mono-caps">Hover</div>
      <div>{{ hover.event.question.content }} = {{ hover.event.question.answer }}</div>
      <div>Submitted: {{ hover.event.answer_submitted ?? '—' }}</div>
      <div>{{ Math.round(hover.ms) }} ms · {{ hover.event.is_correct ? 'correct' : 'wrong' }}</div>
    </div>
  </div>
</template>

<style scoped>
.cdf-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-panel);
}
.legend {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  font-size: 0.8rem;
  color: var(--text-dim);
}
.sw {
  width: 14px;
  height: 3px;
  display: inline-block;
  border-radius: 2px;
}
.sw.correct {
  background: var(--cyan);
  box-shadow: 0 0 6px var(--cyan);
}
.sw.wrong {
  background: var(--red);
  box-shadow: 0 0 6px var(--red);
}
.cdf {
  width: 100%;
  height: auto;
}
.grid line {
  stroke: rgba(122, 162, 247, 0.08);
  stroke-width: 1;
}
.axes line {
  stroke: rgba(192, 202, 245, 0.3);
  stroke-width: 1;
}
.axes text {
  fill: var(--text-dim);
  font-size: 10px;
}
.curve {
  fill: none;
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.curve.correct {
  stroke: var(--cyan);
  filter: drop-shadow(0 0 4px rgba(125, 207, 255, 0.5));
}
.curve.wrong {
  stroke: var(--red);
  filter: drop-shadow(0 0 4px rgba(247, 118, 142, 0.5));
}
.hover-line {
  stroke: rgba(192, 202, 245, 0.35);
  stroke-dasharray: 3 3;
}
.hover-dot {
  fill: var(--accent);
  stroke: var(--bg);
  stroke-width: 1.5;
}
.tooltip {
  align-self: flex-start;
  font-size: 0.8rem;
  padding: 0.35rem 0.6rem;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text);
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}
</style>
