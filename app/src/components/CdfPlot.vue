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
    curves?: CurveSpec[];
    events?: AnswerEvent[];
    // When true, wrongs are folded into each curve at "rate = 0 Hz" and drawn
    // in a dedicated left-edge strip (separate from the log-scaled correct-rate
    // region).
    wrongsAsTail?: boolean;
  }>(),
  { wrongsAsTail: false },
);

const W = 560;
const H = 260;
const PAD_L = 44;
const PAD_R = 22;
const PAD_T = 16;
const PAD_B = 36;
// Width of the "wrong / 0 Hz" strip to the left of the log region. Only
// allocated when any curve contains wrongs + wrongsAsTail is on.
const WRONG_STRIP = 36;

interface Point {
  x: number;
  y: number;
  hz: number;
  event: AnswerEvent;
  isWrongBucket?: boolean;
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

function rateHz(e: AnswerEvent): number {
  return 1000 / Math.max(1, e.response_time_ms);
}

const hasWrongBucket = computed(() => {
  if (!props.wrongsAsTail) return false;
  return derivedCurves.value.some((c) =>
    c.events.some((e) => !e.is_correct || e.is_timeout),
  );
});

const xMinHz = computed(() => {
  const rates = derivedCurves.value.flatMap((c) =>
    c.events.filter((e) => e.is_correct && !e.is_timeout).map(rateHz),
  );
  if (rates.length === 0) return 0.1;
  const min = Math.min(...rates);
  // A little below the slowest observed correct rate, clamped to [0.05, 1] Hz.
  return Math.max(0.05, Math.min(1, min / 1.3));
});

const xMaxHz = computed(() => {
  const rates = derivedCurves.value.flatMap((c) =>
    c.events.filter((e) => e.is_correct && !e.is_timeout).map(rateHz),
  );
  if (rates.length === 0) return 2;
  const sorted = [...rates].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 2;
  return Math.max(1, Math.min(20, p95 * 1.3));
});

function plotStart(): number {
  return PAD_L + (hasWrongBucket.value ? WRONG_STRIP : 0);
}
function plotWidth(): number {
  return W - plotStart() - PAD_R;
}
function wrongBucketX(): number {
  return PAD_L + WRONG_STRIP / 2;
}

function hzToX(hz: number): number {
  const lo = Math.log2(xMinHz.value);
  const hi = Math.log2(xMaxHz.value);
  const v = Math.log2(Math.max(xMinHz.value, hz));
  const frac = (v - lo) / Math.max(1e-6, hi - lo);
  return plotStart() + Math.min(1, Math.max(0, frac)) * plotWidth();
}

function fracToY(f: number): number {
  return H - PAD_B - f * (H - PAD_T - PAD_B);
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
  const sortedCorrect = [...corrects].sort((a, b) => rateHz(a) - rateHz(b));
  const total = sortedCorrect.length + wrongs.length;
  if (total === 0) return [];

  const pts: Point[] = [];

  if (props.wrongsAsTail && wrongs.length > 0) {
    const xw = wrongBucketX();
    pts.push({ x: xw, y: fracToY(0), hz: 0, event: wrongs[0], isWrongBucket: true });
    wrongs.forEach((e, i) => {
      pts.push({
        x: xw,
        y: fracToY((i + 1) / total),
        hz: 0,
        event: e,
        isWrongBucket: true,
      });
    });
    // bridge from the wrong bucket across the divider to plotStart at the
    // current cumulative fraction.
    pts.push({
      x: plotStart(),
      y: fracToY(wrongs.length / total),
      hz: xMinHz.value,
      event: wrongs[wrongs.length - 1],
    });
  } else {
    pts.push({
      x: plotStart(),
      y: fracToY(0),
      hz: xMinHz.value,
      event: sortedCorrect[0] ?? evts[0],
    });
  }

  const offset = wrongs.length;
  sortedCorrect.forEach((e, i) => {
    const x = hzToX(rateHz(e));
    pts.push({
      x,
      y: fracToY((offset + i) / total),
      hz: rateHz(e),
      event: e,
    });
    pts.push({
      x,
      y: fracToY((offset + i + 1) / total),
      hz: rateHz(e),
      event: e,
    });
  });

  if (sortedCorrect.length > 0) {
    const last = sortedCorrect[sortedCorrect.length - 1];
    pts.push({
      x: W - PAD_R,
      y: fracToY(1),
      hz: rateHz(last),
      event: last,
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

// Ticks at powers of 2 within the current range. Equal-width on screen, each
// tick represents a doubling of rate (or halving of response time).
function ticksHz(): number[] {
  const min = xMinHz.value;
  const max = xMaxHz.value;
  const lo = Math.floor(Math.log2(min));
  const hi = Math.ceil(Math.log2(max));
  const out: number[] = [];
  for (let k = lo; k <= hi; k++) {
    const v = Math.pow(2, k);
    if (v >= min * 0.98 && v <= max * 1.02) out.push(v);
  }
  return out;
}

function formatHzTick(hz: number): string {
  if (hz >= 1) return hz.toFixed(0);
  if (hz >= 0.5) return hz.toFixed(1);
  if (hz >= 0.1) return hz.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return hz.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}
</script>

<template>
  <div class="cdf-wrap">
    <div class="legend">
      <template v-for="c in derivedCurves" :key="c.label">
        <span class="sw" :class="c.tone"></span>
        <span class="label">{{ c.label }}</span>
      </template>
      <span class="tail-note mono-caps">
        log₂ Hz · {{ hasWrongBucket ? '0 Hz bucket = wrongs' : 'each tick = doubling' }}
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
          :x1="hasWrongBucket ? PAD_L : plotStart()"
          :x2="W - PAD_R"
          :y1="H - PAD_B - v * (H - PAD_T - PAD_B)"
          :y2="H - PAD_B - v * (H - PAD_T - PAD_B)"
        />
        <line v-for="t in ticksHz()" :key="'x' + t"
          :x1="hzToX(t)"
          :x2="hzToX(t)"
          :y1="PAD_T"
          :y2="H - PAD_B"
        />
      </g>

      <g class="axes">
        <line :x1="plotStart()" :y1="H - PAD_B" :x2="W - PAD_R" :y2="H - PAD_B" />
        <line :x1="plotStart()" :y1="PAD_T" :x2="plotStart()" :y2="H - PAD_B" />

        <!-- wrong-bucket strip to the left of the log axis, separated by a
             dashed divider. Only rendered when any curve has wrongs folded in. -->
        <template v-if="hasWrongBucket">
          <line
            class="tail-divider"
            :x1="plotStart()"
            :x2="plotStart()"
            :y1="PAD_T"
            :y2="H - PAD_B"
          />
          <line
            :x1="PAD_L"
            :y1="H - PAD_B"
            :x2="plotStart()"
            :y2="H - PAD_B"
          />
          <text
            class="tail-label"
            :x="wrongBucketX()"
            :y="H - PAD_B + 14"
            text-anchor="middle"
          >0Hz</text>
        </template>

        <text v-for="t in ticksHz()" :key="'tx' + t"
          :x="hzToX(t)"
          :y="H - PAD_B + 14"
          text-anchor="middle"
        >{{ formatHzTick(t) }}</text>
        <text v-for="v in [0, 0.25, 0.5, 0.75, 1]" :key="'ty' + v"
          :x="PAD_L - 6"
          :y="H - PAD_B - v * (H - PAD_T - PAD_B) + 4"
          text-anchor="end"
        >{{ Math.round(v * 100) }}%</text>
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
        {{ hover.isWrongBucket ? '0 Hz (wrong)' : `${hover.hz.toFixed(2)} Hz` }} ·
        {{ Math.round(hover.event.response_time_ms) }} ms ·
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
