<script setup lang="ts">
import { ref } from 'vue';
import { useSessionStore } from '../stores/sessionStore';

const session = useSessionStore();

const mode = ref<'pick' | 'new'>(session.users.length > 0 ? 'pick' : 'new');
const picked = ref<string>(session.users[0] ?? '');
const newName = ref('');
const busy = ref(false);

async function confirm() {
  busy.value = true;
  try {
    if (mode.value === 'new') {
      const name = newName.value.trim();
      if (!name) return;
      await session.selectUser(name, true);
    } else {
      await session.selectUser(picked.value, false);
    }
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="overlay">
    <div class="panel modal">
      <div class="title">
        <div class="mono-caps">Times Table Flashcards</div>
        <h1 class="glow">Identify Operator</h1>
      </div>

      <div v-if="session.users.length > 0" class="toggle">
        <button
          class="tab"
          :class="{ active: mode === 'pick' }"
          @click="mode = 'pick'"
        >
          Existing
        </button>
        <button
          class="tab"
          :class="{ active: mode === 'new' }"
          @click="mode = 'new'"
        >
          New
        </button>
      </div>

      <div v-if="mode === 'pick'" class="row">
        <label class="mono-caps">Callsign</label>
        <select v-model="picked" data-testid="user-picker">
          <option v-for="u in session.users" :key="u" :value="u">{{ u }}</option>
        </select>
      </div>
      <div v-else class="row">
        <label class="mono-caps">New Callsign</label>
        <input
          v-model="newName"
          type="text"
          maxlength="32"
          placeholder="e.g. alice"
          data-testid="user-new-name"
          @keydown.enter="confirm"
        />
      </div>

      <button
        class="primary big"
        :disabled="busy || (mode === 'new' ? !newName.trim() : !picked)"
        data-testid="user-confirm"
        @click="confirm"
      >
        Engage
      </button>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(10, 14, 26, 0.9);
  display: grid;
  place-items: center;
  backdrop-filter: blur(4px);
  z-index: 100;
}
.modal {
  width: min(420px, 92vw);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 2rem;
}
.title h1 {
  margin: 0;
  font-size: 1.6rem;
  color: var(--accent);
  letter-spacing: 0.04em;
}
.title .mono-caps {
  margin-bottom: 0.5rem;
}
.toggle {
  display: flex;
  gap: 0.5rem;
}
.tab {
  flex: 1;
  padding: 0.5rem;
  font-size: 0.75rem;
}
.tab.active {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--bg-raised);
}
.row {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.big {
  padding: 0.8rem 1rem;
  font-size: 1rem;
}
</style>
