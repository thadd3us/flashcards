<script setup lang="ts">
const props = defineProps<{
  correct: number;
  total: number;
  levelName: string;
}>();
const emit = defineEmits<{
  (e: 'replay'): void;
  (e: 'menu'): void;
}>();
</script>

<template>
  <div class="summary shimmer-in">
    <div class="flourish">✦ — ❖ — ✦</div>
    <h2 class="elvish-h2 title">{{ props.levelName }}</h2>
    <div class="flourish">— ❦ —</div>

    <div class="score-panel panel">
      <div class="mono-caps label">Trial complete</div>
      <div class="score elvish-word">
        {{ props.correct }} <span class="of">/</span> {{ props.total }}
      </div>
      <div class="serif-italic remark">
        <template v-if="props.correct === props.total">
          ✦ A nárë ben — flawless! The Eldar would be proud.
        </template>
        <template v-else-if="props.correct >= Math.ceil(props.total * 0.7)">
          Well-fought. The path of the Eldar grows clearer.
        </template>
        <template v-else>
          Nai tiruvantel — may you study these words again.
        </template>
      </div>
    </div>

    <div class="actions">
      <button @click="emit('replay')">Try again</button>
      <button class="primary" @click="emit('menu')">Choose level</button>
    </div>
  </div>
</template>

<style scoped>
.summary {
  max-width: 640px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
  text-align: center;
}
.title {
  font-size: 1.4rem;
  margin: 0.25rem 0 1rem;
}
.score-panel {
  padding: 2rem 1.5rem;
}
.label { color: var(--accent); }
.score {
  font-size: 3.2rem;
  margin: 0.6rem 0 1rem;
}
.of { color: var(--text-mute); }
.remark { color: var(--text-dim); font-size: 1.1rem; }
.actions {
  display: flex;
  gap: 0.8rem;
  justify-content: center;
  margin-top: 1.4rem;
}
</style>
