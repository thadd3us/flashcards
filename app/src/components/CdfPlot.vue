<script setup lang="ts">
import { computed, ref } from 'vue';
import type { AnswerEvent } from '../types/answerEvent';

interface CurveSpec {
  label: string;
  events: AnswerEvent[];
  tone: 'cyan' | 'accent2' | 'red' | 'green';
}

const props = withDefaults(
  defineProps<{
    curves?: CurveSpec[]; // when supplied, replaces the default correct/wrong split
    events?: AnswerEvent[]; // legacy single-series usage
    wrongsAsTail?: boolean;
  }>(),
  { wrongsAsTail: false },
);

const W = 560;
const H = 260;
const PAD_L = 50;
const PAD_R = 22;
const PAD_T = 16;
const PAD_B = 36;
const TAIL_FRAC = 0.06; // wrong answers pile up here, past the plotted x range

interface Point {
  x: number;
  y: number;
  ms: number;
  event: AnswerEvent;
  isWrongTail?: boolean;
}

const derivedCurves = computed<CurveSpec[]>(() => {
  if (props.curves && props.curves.length > 0) return props.curves;
  const events = props.events ?? [];
  if (props.wrongsAsTail) {
    return [{ label: 'All', events, tone: 'cyan' }];
  }
  return [
    {
      label: 'Correct',
      events: events.filter((e) => e.is_correct && !e.is_timeout),
      tone: 'cyan',
    },
    {
      label: 'Wrong / Miss',
      events: events.filter((e) => !e.is_correct || e.is_timeout),
      tone: 'red',
    },
  ];
});

const xMax = computed(() => {
  const correct = derivedCurves.value.flatMap((c) =>
    c.events.filter((e) => e.is_correct && !e.is_timeout).map((e) => e.response_time_ms),
  );
  if (correct.length === 0) return 6_000;
  const sorted = [...correct].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 6_000;
  return Math.max(2_000, Math.min(15_000, p95 * 1.25));
});

function plotWidth() {
  return W - PAD_L - PAD_R;
}

function msToX(ms: number): number {
  return PAD_L + Math.min(1, ms / xMax.value) * plotWidth();
}

function fracToY(f: number): number {
  return H - PAD_B - f * (H - PAD_T - PAD_B);
}

function tailX(): number {
  return PAD_L + (1 + TAIL_FRAC) * plotWidth();
}

function buildCurve(spec: CurveSpec): Point[] {
  const evts = spec.events;
  if (evts.length === 0) return [];
  const wrongs = props.wrongsAsTail
    ? evts.filter((e) => !e.is_correct || e.is_timeout)
    : [];
  const corrects = props.wrongsAsTail
    ? evts.filter((e) => e.is_correct && !e.is_timeout)
    : evts;
  const sortedCorrect = [...corrects].sort(
    (a, b) => a.response_time_ms - b.response_time_ms,
  );
  const total = sortedCorrect.length + wrongs.length;
  if (total === 0) return [];

  const pts: Point[] = [];
  pts.push({ x: PAD_L, y: fracToY(0), ms: 0, event: sortedCorrect[0] ?? wrongs[0] });

  sortedCorrect.forEach((e, i) => {
    const x = msToX(e.response_time_ms);
    // step: horizontal to this x at previous frac, then vertical up to new frac
    pts.push({
      x,
      y: fracToY(i / total),
      ms: e.response_time_ms,
      event: e,
    });
    pts.push({
      x,
      y: fracToY((i + 1) / total),
      ms: e.response_time_ms,
      event: e,
    });
  });

  if (props.wrongsAsTail && wrongs.length > 0) {
    // horizontal from last correct to the tail bucket, then rise for each wrong.
    const baseFrac = sortedCorrect.length / total;
    const tail = tailX();
    pts.push({
      x: tail,
      y: fracToY(baseFrac),
      ms: xMax.value,
      event: wrongs[0],
      isWrongTail: true,
    });
    wrongs.forEach((e, i) => {
      pts.push({
        x: tail,
        y: fracToY((sortedCorrect.length + i + 1) / total),
        ms: xMax.value,
        event: e,
        isWrongTail: true,
      });
    });
  } else if (sortedCorrect.length > 0) {
    // trail horizontally to right edge for visual completeness
    pts.push({
      x: W - PAD_R,
      y: fracToY(sortedCorrect.length / total),
      ms: xMax.value,
      event: sortedCorrect[sortedCorrect.length - 1],
    });
  }
  return pts;
}

const curveData = computed(() =>
  derivedCurves.value.map((c) => ({ spec: c, pts: buildCurve(c) })),
);

function pathFor(pts: Point[]): string {
  if (pts.length === 0) return '';
  return 'M' + pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L');
}

const hover = ref<Point | null>(null);
const svgRef = ref<SVGSVGElement | null>(null);

function onMove(e: MouseEvent) {
  const all = curveData.value.flatMap((c) => c.pts);
  if (all.length === 0) return;
  const rect = svgRef.value!.getBoundingClientRect();
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

const tailLabelX = computed(() => tailX());
</script>

<template>
  <div class="cdf-wrap">
    <div class="legend">
      <template v-for="c in derivedCurves" :key="c.label">
        <span class="sw" :class="c.tone"></span>
        <span class="label">{{ c.label }}</span>
      </template>
      <span v-if="wrongsAsTail" class="tail-note mono-caps">
        wrongs → right tail
      </span>
    </div>
    <svg
      ref="svgRef"
      :viewBox="`0 0 ${W} ${H}`"
      class="cdf"
      @mousemove="onMove"
      @mouseleave="hover = null"
    >
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

      <g class="axes">
        <line :x1="PAD_L" :y1="H - PAD_B" :x2="W - PAD_R" :y2="H - PAD_B" />
        <line :x1="PAD_L" :y1="PAD_T" :x2="PAD_L" :y2="H - PAD_B" />
        <text v-for="t in ticksX()" :key="'tx' + t"
          :x="PAD_L + (t / xMax) * (W - PAD_L - PAD_R)"
          :y="H - PAD_B + 14"
          text-anchor="middle"
        >{{ (t / 1000).toFixed(1) }}s</text>
        <text v-for="v in [0, 0.25, 0.5, 0.75, 1]" :key="'ty' + v"
          :x="PAD_L - 8"
          :y="H - PAD_B - v * (H - PAD_T - PAD_B) + 4"
          text-anchor="end"
        >{{ Math.round(v * 100) }}%</text>
        <g v-if="wrongsAsTail">
          <line class="tail-divider"
            :x1="W - PAD_R" :x2="W - PAD_R"
            :y1="PAD_T" :y2="H - PAD_B"
          />
          <text class="tail-label"
            :x="tailLabelX - 4" :y="H - PAD_B + 14" text-anchor="end"
          >wrong</text>
        </g>
      </g>

      <path v-for="c in curveData" :key="c.spec.label + '-curve'"
        class="curve" :class="c.spec.tone" :d="pathFor(c.pts)"
      />

      <g v-if="hover">
        <line class="hover-line" :x1="hover.x" :x2="hover.x" :y1="PAD_T" :y2="H - PAD_B" />
        <circle :cx="hover.x" :cy="hover.y" r="4" class="hover-dot" />
      </g>
    </svg>

    <div class="tooltip" v-if="hover">
      <div class="mono-caps">Hover</div>
      <div>{{ hover.event.question.content }} = {{ hover.event.question.answer }}</div>
      <div>Submitted: {{ hover.event.answer_submitted ?? '—' }}</div>
      <div>
        {{ hover.isWrongTail ? '— (wrong)' : `${Math.round(hover.ms)} ms` }} ·
        {{ hover.event.is_correct ? 'correct' : 'wrong' }}
      </div>
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
  flex-wrap: wrap;
}
.tail-note {
  color: var(--text-muted);
  margin-left: auto;
}
.sw {
  width: 14px;
  height: 3px;
  display: inline-block;
  border-radius: 2px;
}
.sw.cyan {
  background: var(--cyan);
  box-shadow: 0 0 6px var(--cyan);
}
.sw.red {
  background: var(--red);
  box-shadow: 0 0 6px var(--red);
}
.sw.accent2 {
  background: var(--accent-2);
  box-shadow: 0 0 6px var(--accent-2);
}
.sw.green {
  background: var(--green);
  box-shadow: 0 0 6px var(--green);
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
.tail-divider {
  stroke: rgba(247, 118, 142, 0.4) !important;
  stroke-dasharray: 3 3;
}
.tail-label {
  fill: var(--red);
  font-size: 10px;
}
.curve {
  fill: none;
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.curve.cyan {
  stroke: var(--cyan);
  filter: drop-shadow(0 0 4px rgba(125, 207, 255, 0.5));
}
.curve.red {
  stroke: var(--red);
  filter: drop-shadow(0 0 4px rgba(247, 118, 142, 0.5));
}
.curve.accent2 {
  stroke: var(--accent-2);
  filter: drop-shadow(0 0 4px rgba(187, 154, 247, 0.5));
  stroke-dasharray: 5 4;
}
.curve.green {
  stroke: var(--green);
  filter: drop-shadow(0 0 4px rgba(158, 206, 106, 0.5));
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
