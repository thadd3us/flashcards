<script setup lang="ts">
import { computed, ref } from 'vue';
import { useSessionStore } from '../stores/sessionStore';
import CdfPlot from './CdfPlot.vue';
import CardHistoryBars from './CardHistoryBars.vue';
import MiniGrid from './MiniGrid.vue';
import type { AnswerEvent } from '../types/answerEvent';
import type { TimeWindow } from '../utils/timeWindow';
import { filterByWindow, TIME_WINDOWS, WINDOW_LABELS } from '../utils/timeWindow';

const session = useSessionStore();

// ── Collapse state ────────────────────────────────────────────────────────────
const cdfOpen   = ref(true);
const histOpen  = ref(true);
const coverOpen = ref(true);

// ── Coverage window ───────────────────────────────────────────────────────────
const coverWin = ref<TimeWindow>('session');

const coverageEvents = computed((): AnswerEvent[] =>
  filterByWindow(session.combinedHistory, coverWin.value, session.history),
);

const TOTAL_CELLS = 169; // 13 × 13

const coverageStats = computed(() => {
  const counts = new Map<string, number>();
  for (const e of coverageEvents.value) {
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

// ── Comparison window (excludes 'session' — first curve is always this session) ─
type CompWin = Exclude<TimeWindow, 'session'>;
const CMP_WINS: CompWin[] = ['day', 'week', 'month', 'all'];
const compWin = ref<CompWin>('day');

// Comparison curve: same filterByWindow logic but only over allTimeHistory
// so there's no double-counting with the current-session curve.
const comparisonEvents = computed((): AnswerEvent[] =>
  filterByWindow(session.allTimeHistory, compWin.value, []),
);

const curves = computed(() => [
  { label: 'This session',           events: session.history,          tone: 'cyan'    as const },
  { label: WINDOW_LABELS[compWin.value], events: comparisonEvents.value, tone: 'accent2' as const },
]);

// ── Most-recent-answer marker ─────────────────────────────────────────────────
const lastEvent = computed((): AnswerEvent | null => {
  for (let i = session.history.length - 1; i >= 0; i--) {
    if (!session.history[i].is_correction) return session.history[i];
  }
  return null;
});

const markerRpm = computed((): number | null | undefined => {
  const e = lastEvent.value;
  if (!e) return undefined;
  if (!e.is_correct || e.is_timeout) return null;
  return 60_000 / Math.max(1, e.response_time_ms);
});

// ── Per-problem history ───────────────────────────────────────────────────────
const lastQuestion = computed(() => lastEvent.value?.question ?? null);

const lastQuestionEvents = computed((): AnswerEvent[] => {
  const uuid = lastEvent.value?.question_uuid;
  if (!uuid) return [];
  return session.combinedHistory.filter((e) => e.question_uuid === uuid);
});
</script>

<template>
  <aside class="right-panel">
    <!-- ── Speed Distribution ─────────────────────────────────────────────── -->
    <section class="panel-section">
      <button class="section-head" @click="cdfOpen = !cdfOpen">
        <span class="tri" :class="{ open: cdfOpen }">▶</span>
        <span class="section-title mono-caps">Speed distribution</span>
      </button>

      <div v-if="cdfOpen" class="section-body">
        <div class="comp-row">
          <button
            v-for="w in CMP_WINS"
            :key="w"
            class="win-btn"
            :class="{ active: compWin === w }"
            :data-testid="`cmp-${w}`"
            @click="compWin = w"
          >{{ WINDOW_LABELS[w] }}</button>
        </div>
        <CdfPlot :curves="curves" :marker-rpm="markerRpm" />
      </div>
    </section>

    <!-- ── Card History ───────────────────────────────────────────────────── -->
    <section class="panel-section">
      <button class="section-head" @click="histOpen = !histOpen">
        <span class="tri" :class="{ open: histOpen }">▶</span>
        <span class="section-title mono-caps">Card history</span>
      </button>

      <div v-if="histOpen" class="section-body">
        <div v-if="lastQuestion" class="card-id">
          <span class="card-expr glow">{{ lastQuestion.content }}</span>
          <span class="card-ans">= {{ lastQuestion.answer }}</span>
          <span class="card-count mono-caps">
            {{ lastQuestionEvents.length }} attempt{{ lastQuestionEvents.length === 1 ? '' : 's' }}
          </span>
        </div>
        <div v-else class="empty mono-caps">Answer a card to see history</div>

        <CardHistoryBars
          v-if="lastQuestion"
          :events="lastQuestionEvents"
          :session-start-timestamp="session.sessionStart"
          :limit="10"
        />
      </div>
    </section>
    <!-- ── Coverage grid ────────────────────────────────────────────────── -->
    <section class="panel-section">
      <button class="section-head" @click="coverOpen = !coverOpen">
        <span class="tri" :class="{ open: coverOpen }">▶</span>
        <span class="section-title mono-caps">Coverage</span>
      </button>

      <div v-if="coverOpen" class="section-body">
        <div class="comp-row">
          <button
            v-for="w in TIME_WINDOWS"
            :key="w"
            class="win-btn"
            :class="{ active: coverWin === w }"
            @click="coverWin = w"
          >{{ WINDOW_LABELS[w] }}</button>
        </div>
        <div class="cover-counts mono-caps">
          <div class="seen">{{ coverageStats.seenCount }} / {{ TOTAL_CELLS }} ({{ coverageStats.pct }}%) seen</div>
          <div v-if="coverageStats.totalRepeats > 0" class="repeats">
            {{ coverageStats.totalRepeats }} repeat{{ coverageStats.totalRepeats === 1 ? '' : 's' }}
            on {{ coverageStats.repeatedCards }} different card{{ coverageStats.repeatedCards === 1 ? '' : 's' }}
          </div>
        </div>
        <MiniGrid :events="coverageEvents" />
      </div>
    </section>
  </aside>
</template>

<style scoped>
.right-panel {
  width: 300px;
  flex-shrink: 0;
  border-left: 1px solid var(--border);
  background: var(--bg-panel);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
}
.panel-section {
  border-bottom: 1px solid var(--border);
}
.section-head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 0.75rem;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  color: var(--text);
  font-size: inherit;
}
.section-head:hover { background: rgba(122, 162, 247, 0.06); }
.tri {
  font-size: 0.6rem;
  color: var(--text-dim);
  transition: transform 0.15s;
  transform: rotate(0deg);
  display: inline-block;
  line-height: 1;
}
.tri.open { transform: rotate(90deg); }
.section-title {
  font-size: 0.7rem;
  color: var(--text-dim);
  letter-spacing: 0.1em;
}
.section-body {
  padding: 0.5rem 0.75rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.comp-row { display: flex; gap: 0.25rem; flex-wrap: wrap; }
.win-btn  { padding: 0.2rem 0.55rem; font-size: 0.65rem; letter-spacing: 0.05em; }
.win-btn.active {
  border-color: var(--cyan);
  color: var(--cyan);
  background: var(--bg-raised);
}
/* Card identity */
.card-id {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  flex-wrap: wrap;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid var(--border);
}
.card-expr {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--cyan);
}
.card-ans {
  font-size: 0.9rem;
  color: var(--text-dim);
}
.card-count {
  margin-left: auto;
  font-size: 0.65rem;
  color: var(--text-muted);
}
.empty {
  font-size: 0.72rem;
  color: var(--text-muted);
  padding: 0.3rem 0;
}
.cover-counts {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  font-size: 0.68rem;
}
.seen    { color: var(--cyan); }
.repeats { color: var(--text-muted); }
.sep     { color: var(--text-dim); }
</style>
