<script setup lang="ts">
import { onBeforeMount, onMounted, onBeforeUnmount } from 'vue';
import { useSessionStore } from './stores/sessionStore';
import SparklineBar from './components/SparklineBar.vue';
import UserSelector from './components/UserSelector.vue';
import DbChooser from './components/DbChooser.vue';
import PlayTab from './components/PlayTab.vue';
import StatsTab from './components/StatsTab.vue';
import SessionSummary from './components/SessionSummary.vue';

const session = useSessionStore();

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
        >
          Play
        </button>
        <button
          class="tab"
          :class="{ active: session.tab === 'stats' }"
          data-testid="tab-stats"
          @click="session.setTab('stats')"
        >
          Stats
        </button>
      </nav>
      <div class="right">
        <SparklineBar v-if="session.phase === 'ready'" />
        <span v-if="session.username" class="user mono-caps" data-testid="active-user">
          ⎔ {{ session.username }}
        </span>
      </div>
    </header>

    <main class="main">
      <template v-if="session.phase === 'ready'">
        <PlayTab v-show="session.tab === 'play'" />
        <StatsTab v-show="session.tab === 'stats'" />
      </template>
      <div v-else class="loading panel">
        <span class="mono-caps">Connecting…</span>
      </div>
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
}
.user {
  color: var(--accent-2);
  font-size: 0.75rem;
}
.main {
  flex: 1 1 auto;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
}
.main > * {
  flex: 1 1 auto;
  min-height: 0;
}
.loading {
  margin: 2rem;
  text-align: center;
}
</style>
