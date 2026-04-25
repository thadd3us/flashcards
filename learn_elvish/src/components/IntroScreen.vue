<script setup lang="ts">
import type { RawLevel } from '../types/level';

const props = defineProps<{ level: RawLevel }>();
const emit = defineEmits<{
  (e: 'begin'): void;
  (e: 'back'): void;
}>();
</script>

<template>
  <div class="intro shimmer-in">
    <div class="topline">
      <button class="ghost" @click="emit('back')">← Levels</button>
      <div class="mono-caps level-tag">{{ props.level.id }}</div>
    </div>

    <div class="flourish">✦ — ❖ — ✦</div>
    <h2 class="elvish-h2 title">{{ props.level.name }}</h2>
    <p class="serif-italic subtitle">{{ props.level.description }}</p>
    <div class="flourish">— ❦ —</div>

    <p class="instr serif-italic">
      Take a moment to study these words before the trial begins.
    </p>

    <div class="word-list">
      <div v-for="card in props.level.cards" :key="card.sindarin" class="word-row">
        <div class="elvish-word side">{{ card.sindarin }}</div>
        <div class="dash">—</div>
        <div class="english-word side english">{{ card.english }}</div>
      </div>
    </div>

    <div class="cta-row">
      <button class="primary pulse-glow" @click="emit('begin')">
        ✧ Begin the Trial ✧
      </button>
    </div>
  </div>
</template>

<style scoped>
.intro {
  max-width: 820px;
  margin: 0 auto;
  padding: 1.5rem 1.5rem 4rem;
  text-align: center;
}
.topline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}
.level-tag {
  color: var(--accent);
}
.title {
  font-size: 1.5rem;
  margin: 0.25rem 0 0.4rem;
}
.subtitle {
  color: var(--text-dim);
  font-size: 1.1rem;
  margin: 0 0 1rem;
}
.instr {
  color: var(--text-dim);
  margin: 0.6rem 0 1.4rem;
}
.word-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.4rem;
  max-width: 520px;
  margin: 0 auto 1.8rem;
  padding: 1.2rem 1.4rem;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 4px;
  position: relative;
}
.word-list::before {
  content: '';
  position: absolute;
  inset: 6px;
  border: 1px solid var(--border-soft);
  border-radius: 2px;
  pointer-events: none;
}
.word-row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: baseline;
  gap: 0.8rem;
  padding: 0.25rem 0;
}
.side {
  font-size: 1.25rem;
}
.elvish-word.side {
  text-align: right;
}
.english.side {
  text-align: left;
}
.dash {
  color: var(--accent);
  opacity: 0.6;
}
.cta-row { margin-top: 1rem; }
</style>
