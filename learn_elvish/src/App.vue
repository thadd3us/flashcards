<script setup lang="ts">
import { computed, ref } from 'vue';
import levelsData from './data/levels.json';
import type { LevelsFile, Question, RawLevel } from './types/level';
import { buildDeck } from './data/engine';
import LevelMenu from './components/LevelMenu.vue';
import IntroScreen from './components/IntroScreen.vue';
import QuestionCard from './components/QuestionCard.vue';
import Summary from './components/Summary.vue';
import SceneBackground from './components/SceneBackground.vue';

const data = levelsData as LevelsFile;

type Phase = 'menu' | 'intro' | 'play' | 'done';

const phase = ref<Phase>('menu');
const selectedLevelId = ref<string | null>(null);
const deck = ref<Question[]>([]);
const cursor = ref(0);
const correctCount = ref(0);

const selectedLevel = computed<RawLevel | null>(() => {
  if (!selectedLevelId.value) return null;
  return data.levels.find((l) => l.id === selectedLevelId.value) ?? null;
});

const currentQuestion = computed<Question | null>(() => {
  return deck.value[cursor.value] ?? null;
});

function pickLevel(id: string) {
  selectedLevelId.value = id;
  phase.value = 'intro';
}

function beginTrial() {
  if (!selectedLevel.value) return;
  deck.value = buildDeck(selectedLevel.value);
  cursor.value = 0;
  correctCount.value = 0;
  phase.value = 'play';
}

function onAnswer(p: { correct: boolean }) {
  if (p.correct) correctCount.value += 1;
}

function onNext() {
  if (cursor.value + 1 >= deck.value.length) {
    phase.value = 'done';
  } else {
    cursor.value += 1;
  }
}

function backToMenu() {
  phase.value = 'menu';
  selectedLevelId.value = null;
  deck.value = [];
  cursor.value = 0;
  correctCount.value = 0;
}

function replayLevel() {
  if (selectedLevel.value) beginTrial();
}
</script>

<template>
  <div class="app-root">
    <SceneBackground />
    <header class="topbar">
      <div class="brand">
        <span class="logo">✦</span>
        <span class="brand-text elvish-title">Pedo Edhellen</span>
      </div>
      <div class="trail mono-caps">
        <span v-if="phase !== 'menu'">{{ selectedLevel?.id }} · {{ selectedLevel?.name?.split('—')[0]?.trim() }}</span>
      </div>
      <div class="right">
        <button v-if="phase !== 'menu'" class="ghost" @click="backToMenu">⌂ Levels</button>
      </div>
    </header>

    <main class="main">
      <LevelMenu v-if="phase === 'menu'" :data="data" @pick="pickLevel" />

      <IntroScreen
        v-else-if="phase === 'intro' && selectedLevel"
        :level="selectedLevel"
        @begin="beginTrial"
        @back="backToMenu"
      />

      <QuestionCard
        v-else-if="phase === 'play' && currentQuestion"
        :key="currentQuestion.key + ':' + cursor"
        :question="currentQuestion"
        :index="cursor"
        :total="deck.length"
        @answer="onAnswer"
        @next="onNext"
      />

      <Summary
        v-else-if="phase === 'done' && selectedLevel"
        :correct="correctCount"
        :total="deck.length"
        :level-name="selectedLevel.name"
        @replay="replayLevel"
        @menu="backToMenu"
      />
    </main>
  </div>
</template>

<style scoped>
.app-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  z-index: 1;
}
.topbar {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  padding: 0.6rem 1.2rem;
  border-bottom: 1px solid var(--border-soft);
  background: linear-gradient(180deg, rgba(11, 17, 36, 0.92), rgba(6, 8, 18, 0.85));
  flex-shrink: 0;
}
.brand {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.logo {
  color: var(--accent);
  font-size: 1.3rem;
  text-shadow: 0 0 10px rgba(231, 198, 106, 0.6);
}
.brand-text {
  font-size: 0.95rem;
}
.trail {
  color: var(--text-dim);
  flex: 1;
  text-align: center;
}
.right { display: flex; align-items: center; gap: 0.5rem; }

.main {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
}
</style>
