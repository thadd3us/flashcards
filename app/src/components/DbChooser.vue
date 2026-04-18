<script setup lang="ts">
import { useSessionStore } from '../stores/sessionStore';

const session = useSessionStore();
</script>

<template>
  <div class="overlay">
    <div class="panel modal">
      <div class="mono-caps">Times Table Flashcards</div>
      <h1 class="glow">Select Data Source</h1>
      <p class="help">
        Choose an existing <code>.flashcards_sqlite</code> file from your family's
        Dropbox, or create a new one.
      </p>
      <div class="row">
        <button
          class="primary big"
          data-testid="db-open-existing"
          @click="session.openExistingDb()"
        >
          Open Existing
        </button>
        <button class="big" data-testid="db-create-new" @click="session.createNewDb()">
          Create New
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(10, 14, 26, 0.92);
  display: grid;
  place-items: center;
  z-index: 100;
}
.modal {
  width: min(480px, 92vw);
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
h1 {
  margin: 0;
  color: var(--accent);
  font-size: 1.6rem;
}
.help {
  color: var(--text-dim);
  font-size: 0.9rem;
  line-height: 1.5;
}
code {
  background: var(--bg);
  padding: 0.1rem 0.35rem;
  border-radius: 3px;
  border: 1px solid var(--border);
  color: var(--cyan);
}
.row {
  display: flex;
  gap: 0.75rem;
}
.big {
  padding: 0.8rem 1rem;
  flex: 1;
}
</style>
