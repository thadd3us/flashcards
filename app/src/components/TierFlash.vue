<script setup lang="ts">
import { computed, watch, ref } from 'vue';
import { useSessionStore } from '../stores/sessionStore';

const session = useSessionStore();
const visible = ref(false);
let timer: number | null = null;

watch(
  () => session.lastFlashKey,
  () => {
    if (!session.lastTier) return;
    visible.value = true;
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      visible.value = false;
    }, 550);
  },
);

const label = computed(() => {
  const t = session.lastTier;
  if (t === 'instant') return 'INSTANT';
  if (t === 'fast') return 'FAST';
  if (t === 'slow') return 'SLOW';
  if (t === 'miss') return 'MISS';
  return '';
});

const tierClass = computed(() => session.lastTier ?? '');
</script>

<template>
  <transition name="flash">
    <div
      v-if="visible && session.lastTier"
      class="flash"
      :class="tierClass"
      :data-testid="`tier-flash-${tierClass}`"
    >
      <div class="label glow">{{ label }}</div>
    </div>
  </transition>
</template>

<style scoped>
.flash {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
  z-index: 30;
}
.label {
  font-size: 4rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-shadow: 0 0 30px currentColor;
}
.instant .label {
  color: var(--neon);
}
.instant {
  background: radial-gradient(circle, rgba(0, 255, 156, 0.2), transparent 60%);
}
.fast .label {
  color: var(--cyan);
}
.fast {
  background: radial-gradient(circle, rgba(125, 207, 255, 0.15), transparent 60%);
}
.slow .label {
  color: var(--yellow);
}
.slow {
  background: radial-gradient(circle, rgba(224, 175, 104, 0.15), transparent 60%);
}
.miss .label {
  color: var(--red);
}
.miss {
  background: radial-gradient(circle, rgba(247, 118, 142, 0.25), transparent 60%);
}
.flash-enter-active,
.flash-leave-active {
  transition: opacity 0.25s ease;
}
.flash-enter-from,
.flash-leave-to {
  opacity: 0;
}
</style>
