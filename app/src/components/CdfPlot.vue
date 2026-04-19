<script setup lang="ts">
import { computed, ref } from 'vue';
import type { AnswerEvent } from '../types/answerEvent';

// CdfPlot always shows two curves in compare mode. Wrongs are always folded
// into a small leftmost strip ("wrong" bucket) so they're visible without
// distorting the log-RPM x-axis. A `markerRpm` prop highlights the most
// recent answer on the first (current-session) curve.
interface CurveSpec {
  label: string;
  events: AnswerEvent[];
  tone: 'cyan' | 'accent2';
}

const props = defineProps<{
  curves: CurveSpec[];
  // RPM of the most-recent answer to highlight on the first curve.
  // Pass null for a wrong/timeout (marker appears in wrong strip).
  // Omit (undefined) to suppress the marker entirely.
  markerRpm?: number | null;
}>();

const W = 480;
const H = 220;
const PAD_L = 42;
const PAD_R = 18;
const PAD_T = 12;
const PAD_B = 30;
const WRONG_STRIP = 36;
const NUM_HIST_BINS = 16;

function rateRpm(e: AnswerEvent): number {
  return 60_000 / Math.max(1, e.response_time_ms);
}

const hasWrongBucket = computed(() =>
  props.curves.some((c) => c.events.some((e) => !e.is_correct || e.is_timeout)),
);

const plotStart = computed(() => PAD_L + (hasWrongBucket.value ? WRONG_STRIP : 0));
const plotWidth = computed(() => W - plotStart.value - PAD_R);

function wrongBucketX() {
  return PAD_L + WRONG_STRIP / 2;
}

const xMinRpm = computed(() => {
  const rates = props.curves.flatMap((c) =>
    c.events.filter((e) => e.is_correct && !e.is_timeout).map(rateRpm),
  );
  if (rates.length === 0) return 6;
  return Math.max(3, Math.min(60, Math.min(...rates) / 1.3));
});

const xMaxRpm = computed(() => {
  const rates = props.curves.flatMap((c) =>
    c.events.filter((e) => e.is_correct && !e.is_timeout).map(rateRpm),
  );
  if (rates.length === 0) return 120;
  const sorted = [...rates].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 120;
  return Math.max(60, Math.min(1200, p95 * 1.3));
});

function rpmToX(rpm: number): number {
  const lo = Math.log10(xMinRpm.value);
  const hi = Math.log10(xMaxRpm.value);
  const v = Math.log10(Math.max(xMinRpm.value, rpm));
  const frac = (v - lo) / Math.max(1e-6, hi - lo);
  return plotStart.value + Math.min(1, Math.max(0, frac)) * plotWidth.value;
}

function fracToY(f: number): number {
  return H - PAD_B - f * (H - PAD_T - PAD_B);
}

// ── CDF curve points ────────────────────────────────────────────────────────

interface Point {
  x: number;
  y: number;
  rpm: number;
  event: AnswerEvent;
  isWrongBucket?: boolean;
}

function buildCurve(spec: CurveSpec): Point[] {
  const wrongs = spec.events.filter((e) => !e.is_correct || e.is_timeout);
  const corrects = spec.events.filter((e) => e.is_correct && !e.is_timeout);
  const sorted = [...corrects].sort((a, b) => rateRpm(a) - rateRpm(b));
  const total = sorted.length + wrongs.length;
  if (total === 0) return [];

  const pts: Point[] = [];
  const xw = wrongBucketX();

  if (wrongs.length > 0) {
    pts.push({ x: xw, y: fracToY(0), rpm: 0, event: wrongs[0], isWrongBucket: true });
    wrongs.forEach((e, i) => {
      pts.push({ x: xw, y: fracToY((i + 1) / total), rpm: 0, event: e, isWrongBucket: true });
    });
    pts.push({ x: plotStart.value, y: fracToY(wrongs.length / total), rpm: xMinRpm.value, event: wrongs[wrongs.length - 1] });
  } else {
    pts.push({ x: plotStart.value, y: fracToY(0), rpm: xMinRpm.value, event: sorted[0] ?? spec.events[0] });
  }

  const offset = wrongs.length;
  sorted.forEach((e, i) => {
    const x = rpmToX(rateRpm(e));
    pts.push({ x, y: fracToY((offset + i) / total), rpm: rateRpm(e), event: e });
    pts.push({ x, y: fracToY((offset + i + 1) / total), rpm: rateRpm(e), event: e });
  });
  if (sorted.length > 0) {
    pts.push({ x: W - PAD_R, y: fracToY(1), rpm: rateRpm(sorted[sorted.length - 1]), event: sorted[sorted.length - 1] });
  }
  return pts;
}

// ── Histograms ───────────────────────────────────────────────────────────────

interface HistBin { x1: number; x2: number; y: number; h: number }

function buildHistogram(events: AnswerEvent[], fillH: number): { bins: HistBin[]; wrongH: number } {
  const logMin = Math.log10(xMinRpm.value);
  const logMax = Math.log10(xMaxRpm.value);
  const bw = (logMax - logMin) / NUM_HIST_BINS;
  const counts = new Array(NUM_HIST_BINS).fill(0);
  let wrongCount = 0;

  for (const e of events) {
    if (!e.is_correct || e.is_timeout) { wrongCount++; continue; }
    const rpm = rateRpm(e);
    const log = Math.log10(Math.max(xMinRpm.value, Math.min(xMaxRpm.value, rpm)));
    const idx = Math.min(NUM_HIST_BINS - 1, Math.floor((log - logMin) / bw));
    counts[idx]++;
  }

  const maxCount = Math.max(1, ...counts);
  const total = Math.max(1, events.length);
  const bins = counts.map((cnt, i) => {
    const x1 = rpmToX(Math.pow(10, logMin + i * bw));
    const x2 = Math.max(x1 + 1, rpmToX(Math.pow(10, logMin + (i + 1) * bw)));
    const h = (cnt / maxCount) * fillH;
    return { x1, x2, y: H - PAD_B - h, h };
  });

  return { bins, wrongH: (wrongCount / total) * fillH };
}

// ── Reactive data ────────────────────────────────────────────────────────────

const HIST_FILL = (H - PAD_T - PAD_B) * 0.45;

const curveData = computed(() =>
  props.curves.map((c) => ({
    spec: c,
    pts: buildCurve(c),
    hist: buildHistogram(c.events, HIST_FILL),
  })),
);

function pathFor(pts: Point[]): string {
  if (pts.length === 0) return '';
  return 'M' + pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L');
}

// ── Marker (most-recent answer) ──────────────────────────────────────────────

const markerPos = computed(() => {
  if (props.markerRpm === undefined) return null;
  const curve = curveData.value[0];
  if (!curve) return null;
  const events = curve.spec.events;
  const total = events.length;
  if (total === 0) return null;

  if (props.markerRpm === null) {
    // Wrong answer — marker sits in the wrong strip
    const wrongs = events.filter((e) => !e.is_correct || e.is_timeout).length;
    return { x: wrongBucketX(), y: fracToY(wrongs / total) };
  }

  const wrongs = events.filter((e) => !e.is_correct || e.is_timeout).length;
  const corrects = events.filter((e) => e.is_correct && !e.is_timeout);
  const below = corrects.filter((e) => rateRpm(e) <= props.markerRpm!).length;
  return { x: rpmToX(props.markerRpm), y: fracToY((wrongs + below) / total) };
});

// ── Ticks ────────────────────────────────────────────────────────────────────

function majorTicksRpm(): number[] {
  const lo = Math.floor(Math.log10(xMinRpm.value));
  const hi = Math.ceil(Math.log10(xMaxRpm.value));
  const out: number[] = [];
  for (let k = lo; k <= hi; k++) {
    const v = Math.pow(10, k);
    if (v >= xMinRpm.value * 0.98 && v <= xMaxRpm.value * 1.02) out.push(v);
  }
  return out;
}

function minorTicksRpm(): number[] {
  const lo = Math.floor(Math.log10(xMinRpm.value));
  const hi = Math.ceil(Math.log10(xMaxRpm.value));
  const out: number[] = [];
  for (let k = lo; k <= hi; k++) {
    const base = Math.pow(10, k);
    for (let n = 2; n <= 9; n++) {
      const v = n * base;
      if (v >= xMinRpm.value * 0.98 && v <= xMaxRpm.value * 1.02) out.push(v);
    }
  }
  return out;
}

function fmtTick(rpm: number): string {
  if (rpm >= 10) return rpm.toFixed(0);
  if (rpm >= 1) return rpm.toFixed(1);
  return rpm.toFixed(2);
}

// ── Hover ────────────────────────────────────────────────────────────────────

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
    if (d < bestD) { bestD = d; best = p; }
  }
  hover.value = bestD < 600 ? best : null;
}

// Tone → fill colors for histograms
const histFill: Record<string, string> = {
  cyan: 'rgba(125,207,255,',
  accent2: 'rgba(187,154,247,',
};
</script>

<template>
  <div class="cdf-wrap">
    <div class="legend">
      <template v-for="c in curves" :key="c.label">
        <span class="sw" :class="c.tone"></span>
        <span class="lbl">{{ c.label }}</span>
      </template>
      <span class="axis-note mono-caps">log₁₀ RPM · ▮ = wrongs</span>
    </div>

    <svg
      ref="svgRef"
      :viewBox="`0 0 ${W} ${H}`"
      class="cdf"
      @mousemove="onMove"
      @mouseleave="hover = null"
    >
      <!-- Histograms (behind everything) -->
      <g v-for="(cd, ci) in curveData" :key="'hist' + ci">
        <!-- wrong bucket histogram bar -->
        <rect
          v-if="hasWrongBucket && cd.hist.wrongH > 0"
          :x="PAD_L + 2"
          :y="H - PAD_B - cd.hist.wrongH"
          :width="WRONG_STRIP - 4"
          :height="cd.hist.wrongH"
          :fill="`${histFill[cd.spec.tone]}${ci === 0 ? 0.25 : 0.14})`"
          rx="2"
        />
        <!-- correct-rate bins -->
        <rect
          v-for="(bin, bi) in cd.hist.bins"
          :key="'bin' + bi"
          :x="bin.x1 + 1"
          :y="bin.y"
          :width="Math.max(1, bin.x2 - bin.x1 - 2)"
          :height="bin.h"
          :fill="`${histFill[cd.spec.tone]}${ci === 0 ? 0.25 : 0.14})`"
          rx="1"
        />
      </g>

      <!-- Grid -->
      <g class="grid">
        <line v-for="v in [0, 0.25, 0.5, 0.75, 1]" :key="'y' + v"
          :x1="hasWrongBucket ? PAD_L : plotStart" :x2="W - PAD_R"
          :y1="fracToY(v)" :y2="fracToY(v)"
        />
        <line v-for="t in minorTicksRpm()" :key="'mnr' + t" class="minor"
          :x1="rpmToX(t)" :x2="rpmToX(t)" :y1="PAD_T" :y2="H - PAD_B"
        />
        <line v-for="t in majorTicksRpm()" :key="'maj' + t" class="major"
          :x1="rpmToX(t)" :x2="rpmToX(t)" :y1="PAD_T" :y2="H - PAD_B"
        />
      </g>

      <!-- Axes -->
      <g class="axes">
        <line :x1="plotStart" :y1="H - PAD_B" :x2="W - PAD_R" :y2="H - PAD_B" />
        <line :x1="plotStart" :y1="PAD_T" :x2="plotStart" :y2="H - PAD_B" />
        <template v-if="hasWrongBucket">
          <line class="tail-div" :x1="plotStart" :x2="plotStart" :y1="PAD_T" :y2="H - PAD_B" />
          <line :x1="PAD_L" :y1="H - PAD_B" :x2="plotStart" :y2="H - PAD_B" />
          <text class="wrong-lbl" :x="wrongBucketX()" :y="H - PAD_B + 12" text-anchor="middle">✕</text>
        </template>
        <text v-for="t in majorTicksRpm()" :key="'tx' + t"
          :x="rpmToX(t)" :y="H - PAD_B + 12" text-anchor="middle">{{ fmtTick(t) }}</text>
        <text v-for="v in [0, 0.5, 1]" :key="'ty' + v"
          :x="PAD_L - 4" :y="fracToY(v) + 4" text-anchor="end">{{ Math.round(v * 100) }}%</text>
      </g>

      <!-- CDF curves (on top of histograms) -->
      <path v-for="cd in curveData" :key="cd.spec.label + '-curve'"
        class="curve" :class="cd.spec.tone" :d="pathFor(cd.pts)"
      />

      <!-- Most-recent-answer marker -->
      <g v-if="markerPos">
        <line class="marker-line"
          :x1="markerPos.x" :x2="markerPos.x" :y1="PAD_T" :y2="H - PAD_B"
        />
        <circle class="marker-dot" :cx="markerPos.x" :cy="markerPos.y" r="4" />
      </g>

      <!-- Hover -->
      <g v-if="hover">
        <line class="hover-line" :x1="hover.x" :x2="hover.x" :y1="PAD_T" :y2="H - PAD_B" />
        <circle class="hover-dot" :cx="hover.x" :cy="hover.y" r="3.5" />
      </g>
    </svg>

    <div v-if="hover" class="tooltip">
      <div>{{ hover.event.question.content }} = {{ hover.event.question.answer }}</div>
      <div>
        {{ hover.isWrongBucket ? 'Wrong / Miss' : `${hover.rpm.toFixed(1)} RPM` }} ·
        {{ hover.event.is_correct ? 'correct' : 'wrong' }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.cdf-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.legend {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  font-size: 0.72rem;
  color: var(--text-dim);
  flex-wrap: wrap;
}
.axis-note {
  color: var(--text-muted);
  margin-left: auto;
  font-size: 0.65rem;
}
.sw {
  width: 12px;
  height: 3px;
  display: inline-block;
  border-radius: 2px;
  flex-shrink: 0;
}
.sw.cyan   { background: var(--cyan);     box-shadow: 0 0 5px var(--cyan); }
.sw.accent2{ background: var(--accent-2); box-shadow: 0 0 5px var(--accent-2); }
.lbl { font-size: 0.72rem; }
.cdf { width: 100%; height: auto; }
.grid line { stroke: rgba(122,162,247,0.08); stroke-width: 1; }
.grid line.minor { stroke: rgba(122,162,247,0.12); stroke-dasharray: 1 3; }
.grid line.major { stroke: rgba(122,162,247,0.22); }
.axes line  { stroke: rgba(192,202,245,0.3); stroke-width: 1; }
.axes text  { fill: var(--text-dim); font-size: 9px; }
.tail-div   { stroke: rgba(247,118,142,0.4) !important; stroke-dasharray: 3 3; }
.wrong-lbl  { fill: var(--red); font-size: 9px; }
.curve { fill: none; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.curve.cyan   { stroke: var(--cyan);     filter: drop-shadow(0 0 3px rgba(125,207,255,0.5)); }
.curve.accent2{ stroke: var(--accent-2); filter: drop-shadow(0 0 3px rgba(187,154,247,0.4)); stroke-dasharray: 5 4; }
.marker-line { stroke: var(--yellow); stroke-width: 1.5; stroke-dasharray: 3 3; opacity: 0.75; }
.marker-dot  { fill: var(--yellow); stroke: var(--bg); stroke-width: 1.5; opacity: 0.9; }
.hover-line  { stroke: rgba(192,202,245,0.3); stroke-dasharray: 3 3; }
.hover-dot   { fill: var(--accent); stroke: var(--bg); stroke-width: 1.5; }
.tooltip {
  font-size: 0.75rem;
  padding: 0.3rem 0.55rem;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text);
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}
</style>
