<script setup lang="ts">
const emit = defineEmits<{
  (e: 'key', value: string): void;
  (e: 'backspace'): void;
  (e: 'space'): void;
  (e: 'submit'): void;
}>();

// Sindarin uses Latin letters with circumflex on long vowels.
const rows: string[][] = [
  ['â', 'ê', 'î', 'ô', 'û', 'ŷ', "'"],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];
</script>

<template>
  <div class="kb">
    <div v-for="(row, ri) in rows" :key="ri" class="row" :class="{ 'row-vowels': ri === 0 }">
      <button
        v-for="ch in row"
        :key="ch"
        class="key"
        :class="{ 'key-vowel': 'âêîôûŷ'.includes(ch) }"
        @click="emit('key', ch)"
      >{{ ch }}</button>
    </div>
    <div class="row row-bottom">
      <button class="key key-wide" @click="emit('backspace')">⌫ Delete</button>
      <button class="key key-space" @click="emit('space')">⎵ space</button>
      <button class="key key-wide key-submit" @click="emit('submit')">↵ Speak</button>
    </div>
  </div>
</template>

<style scoped>
.kb {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.9rem;
  background: var(--panel-strong);
  border: 1px solid var(--border);
  border-radius: 4px;
  position: relative;
}
.kb::before {
  content: '';
  position: absolute;
  inset: 5px;
  border: 1px solid var(--border-soft);
  border-radius: 2px;
  pointer-events: none;
}
.row {
  display: flex;
  justify-content: center;
  gap: 0.35rem;
}
.row-vowels { margin-bottom: 0.3rem; }
.row-bottom { margin-top: 0.3rem; }
.key {
  font-family: 'EB Garamond', serif;
  font-size: 1.1rem;
  letter-spacing: 0.02em;
  text-transform: none;
  min-width: 2.4rem;
  padding: 0.45rem 0.55rem;
  background: linear-gradient(180deg, rgba(40, 56, 100, 0.6), rgba(11, 17, 36, 0.85));
  color: var(--mithril);
}
.key-vowel {
  color: var(--accent-bright);
  border-color: rgba(231, 198, 106, 0.5);
  text-shadow: 0 0 8px rgba(231, 198, 106, 0.4);
}
.key-wide {
  min-width: 6.5rem;
  font-family: 'Cinzel', serif;
  font-size: 0.78rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.key-space {
  flex: 1;
  max-width: 18rem;
}
.key-submit {
  border-color: var(--accent);
  color: var(--accent-bright);
}
.key:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent-bright);
  box-shadow: 0 0 12px rgba(231, 198, 106, 0.35);
}
</style>
