<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';
import type { Question } from '../types/level';
import ElvishKeyboard from './ElvishKeyboard.vue';
import { normalize } from '../data/engine';

const props = defineProps<{
  question: Question;
  index: number;
  total: number;
}>();

const emit = defineEmits<{
  (e: 'answer', payload: { correct: boolean; given: string }): void;
  (e: 'next'): void;
}>();

const result = ref<null | 'correct' | 'wrong'>(null);
const chosen = ref<string | null>(null);
const typed = ref('');
const inputRef = ref<HTMLInputElement | null>(null);

const isSpelling = computed(() => props.question.mode === 'spelling');

watch(
  () => props.question.key,
  () => {
    result.value = null;
    chosen.value = null;
    typed.value = '';
    nextTick(() => {
      if (isSpelling.value && inputRef.value) inputRef.value.focus();
    });
  },
  { immediate: true },
);

function pickChoice(c: string) {
  if (result.value !== null) return;
  chosen.value = c;
  const correct = c === props.question.answer;
  result.value = correct ? 'correct' : 'wrong';
  emit('answer', { correct, given: c });
}

function submitTyped() {
  if (result.value !== null) {
    emit('next');
    return;
  }
  if (typed.value.trim() === '') return;
  const correct = normalize(typed.value) === normalize(props.question.answer);
  result.value = correct ? 'correct' : 'wrong';
  emit('answer', { correct, given: typed.value });
}

function appendKey(ch: string) {
  if (result.value !== null) return;
  typed.value += ch;
  inputRef.value?.focus();
}
function backspace() {
  if (result.value !== null) return;
  typed.value = typed.value.slice(0, -1);
  inputRef.value?.focus();
}
function spaceKey() {
  if (result.value !== null) return;
  typed.value += ' ';
  inputRef.value?.focus();
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault();
    submitTyped();
  }
}
</script>

<template>
  <div class="card-wrap shimmer-in">
    <div class="progress mono-caps">
      Card {{ props.index + 1 }} of {{ props.total }}
    </div>

    <div class="prompt-area panel">
      <div v-if="props.question.promptLabel" class="prompt-label mono-caps">
        {{ props.question.promptLabel }}
      </div>
      <div
        class="prompt-text"
        :class="props.question.promptIsElvish ? 'elvish-word' : 'english-word'"
      >
        {{ props.question.prompt }}
      </div>
      <div class="ask serif-italic">
        <template v-if="isSpelling">Type the Sindarin spelling.</template>
        <template v-else-if="props.question.answerLabel">
          Choose the correct {{ props.question.answerLabel }}.
        </template>
        <template v-else-if="props.question.promptIsElvish">
          Choose the English meaning.
        </template>
        <template v-else>
          Choose the Sindarin word.
        </template>
      </div>
    </div>

    <!-- Multiple choice -->
    <div
      v-if="!isSpelling"
      class="choices"
      :class="`choices-${(props.question.choices?.length ?? 4)}`"
    >
      <button
        v-for="c in props.question.choices"
        :key="c"
        class="choice"
        :class="{
          chosen: chosen === c,
          'choice-correct': result !== null && c === props.question.answer,
          'choice-wrong': result === 'wrong' && chosen === c && c !== props.question.answer,
          'choice-elvish': props.question.answerIsElvish,
        }"
        :disabled="result !== null"
        @click="pickChoice(c)"
      >
        {{ c }}
      </button>
    </div>

    <!-- Spelling -->
    <div v-else class="spell-area">
      <input
        ref="inputRef"
        v-model="typed"
        :disabled="result !== null"
        class="spell-input elvish-word"
        :class="{ 'input-correct': result === 'correct', 'input-wrong': result === 'wrong' }"
        spellcheck="false"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        placeholder="…"
        @keydown="onKeydown"
      />
      <ElvishKeyboard
        @key="appendKey"
        @backspace="backspace"
        @space="spaceKey"
        @submit="submitTyped"
      />
    </div>

    <!-- Result + next -->
    <div v-if="result !== null" class="result-area">
      <div v-if="result === 'correct'" class="banner correct">
        <span class="glow">✦ Mae carnen!</span>
        <span class="serif-italic"> — well done.</span>
      </div>
      <div v-else class="banner wrong">
        <span class="glow">✗ Ú-vae.</span>
        <span class="serif-italic"> The answer is</span>
        <span class="answer elvish-word"> {{ props.question.answer }}</span>
      </div>
      <div v-if="props.question.note" class="note serif-italic">{{ props.question.note }}</div>
      <button class="primary next-btn" @click="emit('next')">
        Continue ›
      </button>
    </div>
  </div>
</template>

<style scoped>
.card-wrap {
  max-width: 760px;
  margin: 0 auto;
  padding: 1rem 1.5rem 4rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.progress {
  text-align: center;
  color: var(--text-mute);
}
.prompt-area {
  text-align: center;
  padding: 1.6rem 1.4rem 1.4rem;
}
.prompt-label {
  color: var(--accent);
  margin-bottom: 0.5rem;
}
.prompt-text {
  font-size: 2.4rem;
  line-height: 1.15;
  margin-bottom: 0.6rem;
}
.ask {
  color: var(--text-dim);
  font-size: 1rem;
}

.choices {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.7rem;
}
.choices-2 { grid-template-columns: repeat(2, 1fr); }
.choices-3 { grid-template-columns: repeat(3, 1fr); }
.choices-4 { grid-template-columns: repeat(2, 1fr); }
.choices-5 { grid-template-columns: repeat(3, 1fr); }
.choices-6 { grid-template-columns: repeat(3, 1fr); }
.choices-7,
.choices-8 { grid-template-columns: repeat(4, 1fr); }
.choices-9 { grid-template-columns: repeat(3, 1fr); }
.choices-10,
.choices-11,
.choices-12 { grid-template-columns: repeat(4, 1fr); }
@media (max-width: 640px) {
  .choices,
  .choices-3,
  .choices-5,
  .choices-6,
  .choices-7,
  .choices-8,
  .choices-9,
  .choices-10,
  .choices-11,
  .choices-12 {
    grid-template-columns: repeat(2, 1fr);
  }
}
.choice {
  font-family: 'EB Garamond', serif;
  text-transform: none;
  letter-spacing: 0.02em;
  font-size: 1.25rem;
  padding: 1rem 1.1rem;
  min-height: 4rem;
}
.choice.choice-elvish {
  font-family: 'Cormorant Garamond', serif;
  font-style: italic;
  color: var(--accent-bright);
}
.choice-correct {
  border-color: var(--leaf) !important;
  color: var(--leaf) !important;
  box-shadow: 0 0 18px rgba(143, 191, 154, 0.5) !important;
}
.choice-wrong {
  border-color: var(--ember) !important;
  color: var(--ember) !important;
  box-shadow: 0 0 14px rgba(215, 107, 74, 0.45) !important;
}

.spell-area {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
}
.spell-input {
  width: 100%;
  max-width: 540px;
  text-align: center;
  font-size: 1.8rem;
  padding: 0.8rem 1rem;
}
.input-correct {
  border-color: var(--leaf) !important;
  color: var(--leaf) !important;
  box-shadow: 0 0 16px rgba(143, 191, 154, 0.45) !important;
}
.input-wrong {
  border-color: var(--ember) !important;
  color: var(--ember) !important;
  box-shadow: 0 0 14px rgba(215, 107, 74, 0.4) !important;
}

.result-area {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  align-items: center;
}
.banner {
  font-size: 1.2rem;
}
.banner.correct { color: var(--leaf); }
.banner.wrong { color: var(--ember); }
.answer { color: var(--accent-bright); }
.note {
  color: var(--text-dim);
  font-size: 0.95rem;
}
.next-btn { margin-top: 0.4rem; }
</style>
