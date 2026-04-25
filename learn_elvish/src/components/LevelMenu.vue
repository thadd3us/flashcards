<script setup lang="ts">
import type { LevelsFile } from '../types/level';

const props = defineProps<{ data: LevelsFile }>();
const emit = defineEmits<{ (e: 'pick', levelId: string): void }>();

function modeLabel(level: { defaultMode?: string; cards: { mode?: string }[] }): string {
  const hasSpelling = level.defaultMode === 'spelling' || level.cards.some((c) => c.mode === 'spelling');
  return hasSpelling ? 'Spelling' : 'Multiple choice';
}
</script>

<template>
  <div class="menu-wrap shimmer-in">
    <div class="hero">
      <div class="flourish">✦ ❖ ✦</div>
      <h1 class="elvish-title hero-title">{{ props.data.title }}</h1>
      <p class="serif-italic hero-sub">{{ props.data.subtitle }}</p>
      <div class="flourish">— ❦ —</div>
    </div>

    <div class="levels-grid">
      <button
        v-for="level in props.data.levels"
        :key="level.id"
        class="level-card"
        @click="emit('pick', level.id)"
      >
        <div class="level-id mono-caps">{{ level.id }}</div>
        <div class="level-name elvish-h2">{{ level.name }}</div>
        <div class="level-desc serif-italic">{{ level.description }}</div>
        <div class="level-meta">
          <span class="mono-caps">{{ level.cards.length }} cards</span>
          <span class="dot">·</span>
          <span class="mono-caps">{{ modeLabel(level) }}</span>
        </div>
      </button>
    </div>
  </div>
</template>

<style scoped>
.menu-wrap {
  max-width: 980px;
  margin: 0 auto;
  padding: 2rem 1.5rem 4rem;
}
.hero {
  text-align: center;
  margin-bottom: 2.5rem;
}
.hero-title {
  font-size: 2.6rem;
  margin: 0.5rem 0 0.4rem;
}
.hero-sub {
  color: var(--text-dim);
  font-size: 1.1rem;
  margin: 0 0 0.6rem;
}
.levels-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}
.level-card {
  text-align: left;
  padding: 1.1rem 1.1rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  text-transform: none;
  letter-spacing: normal;
  min-height: 150px;
}
.level-id {
  color: var(--accent);
  font-size: 0.7rem;
}
.level-name {
  font-size: 1.05rem;
  letter-spacing: 0.06em;
}
.level-desc {
  font-size: 0.98rem;
  color: var(--text-dim);
  line-height: 1.35;
  flex: 1;
}
.level-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-mute);
}
.dot { color: var(--accent); opacity: 0.6; }
</style>
