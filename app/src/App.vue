<script setup lang="ts">
import { onBeforeMount, onMounted, onBeforeUnmount, ref } from 'vue';
import { useSessionStore } from './stores/sessionStore';
import { useGameStore } from './stores/gameStore';
import SparklineBar from './components/SparklineBar.vue';
import UserSelector from './components/UserSelector.vue';
import DbChooser from './components/DbChooser.vue';
import PlayTab from './components/PlayTab.vue';
import StatsTab from './components/StatsTab.vue';
import RightPanel from './components/RightPanel.vue';
import SessionSummary from './components/SessionSummary.vue';

const session = useSessionStore();
const game = useGameStore();

const showSettings = ref(false);

onBeforeMount(() => {
  session.boot();
});

function onBeforeUnload() {
  session.endSession();
}

onMounted(() => {
  window.addEventListener('beforeunload', onBeforeUnload);
});
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', onBeforeUnload);
});
</script>

<template>
  <div class="app-root">
    <header class="topbar">
      <div class="brand">
        <span class="logo glow">◆</span>
        <span class="name mono-caps">Times Table Flashcards</span>
      </div>
      <nav v-if="session.phase === 'ready'" class="tabs">
        <button
          class="tab"
          :class="{ active: session.tab === 'play' }"
          data-testid="tab-play"
          @click="session.setTab('play')"
        >Play</button>
        <button
          class="tab"
          :class="{ active: session.tab === 'stats' }"
          data-testid="tab-stats"
          @click="session.setTab('stats')"
        >Stats</button>
      </nav>
      <div class="right">
        <SparklineBar v-if="session.phase === 'ready'" />
        <span v-if="session.username" class="user mono-caps" data-testid="active-user">
          ⎔ {{ session.username }}
        </span>
        <!-- Settings gear -->
        <div v-if="session.phase === 'ready'" class="gear-wrap">
          <button class="gear-btn" @click="showSettings = !showSettings" title="Settings">⚙</button>
          <div v-if="showSettings" class="settings-pop panel">
            <div class="set-title mono-caps">Timeout pressure</div>
            <input
              type="range" min="50" max="99" step="1"
              :value="Math.round(game.fallPercentile * 100)"
              @input="game.setFallPercentile(($event.target as HTMLInputElement).valueAsNumber / 100)"
              class="pressure-slider"
            />
            <div class="set-val mono-caps">
              {{ Math.round(game.fallPercentile * 100) }}th pct ·
              {{ (game.difficulty.fallDurationMs / 1000).toFixed(0) }}s timeout
            </div>
            <div class="set-hint">Lower = faster cards</div>
          </div>
        </div>
      </div>
    </header>

    <main class="main">
      <div class="content-area">
        <template v-if="session.phase === 'ready'">
          <PlayTab v-show="session.tab === 'play'" />
          <StatsTab v-show="session.tab === 'stats'" />
        </template>
        <div v-else class="loading panel">
          <span class="mono-caps">Connecting…</span>
        </div>
      </div>
      <RightPanel v-if="session.phase === 'ready'" />
    </main>

    <DbChooser v-if="session.phase === 'needs-db'" />
    <UserSelector v-if="session.phase === 'needs-user'" />
    <SessionSummary v-if="session.showSessionSummary" />
  </div>
</template>

<style scoped>
.app-root {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.topbar {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--border);
  background: linear-gradient(180deg, rgba(22, 27, 44, 0.95), rgba(16, 20, 32, 0.9));
  flex-shrink: 0;
}
.brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.logo {
  color: var(--accent);
  font-size: 1.4rem;
}
.name {
  color: var(--text);
  letter-spacing: 0.2em;
  font-size: 0.78rem;
}
.tabs {
  display: flex;
  gap: 0.4rem;
}
.tab {
  padding: 0.4rem 1rem;
  font-size: 0.7rem;
  letter-spacing: 0.2em;
}
.tab.active {
  color: var(--cyan);
  border-color: var(--cyan);
  background: var(--bg-raised);
  box-shadow: 0 0 12px rgba(125, 207, 255, 0.25);
}
.right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 1rem;
  position: relative;
}
.user {
  color: var(--accent-2);
  font-size: 0.75rem;
}
/* ── Main area: content + right panel side by side ────────────────────── */
.main {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: row;
  overflow: hidden;
}
.content-area {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.content-area > * {
  flex: 1 1 auto;
  min-height: 0;
}
.loading {
  margin: 2rem;
  text-align: center;
}
/* ── Settings popover ─────────────────────────────────────────────────── */
.gear-wrap {
  position: relative;
}
.gear-btn {
  font-size: 1rem;
  padding: 0.25rem 0.5rem;
  background: none;
  border: 1px solid var(--border);
  color: var(--text-dim);
  cursor: pointer;
  border-radius: 4px;
}
.gear-btn:hover {
  color: var(--text);
  border-color: var(--text-dim);
}
.settings-pop {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 240px;
  padding: 0.85rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  z-index: 200;
  border: 1px solid var(--border);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}
.set-title {
  font-size: 0.72rem;
  color: var(--accent);
}
.pressure-slider {
  width: 100%;
  accent-color: var(--cyan);
}
.set-val {
  font-size: 0.7rem;
  color: var(--cyan);
}
.set-hint {
  font-size: 0.68rem;
  color: var(--text-muted);
}
</style>
