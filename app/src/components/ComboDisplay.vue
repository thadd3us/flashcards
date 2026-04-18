<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useSessionStore } from '../stores/sessionStore';
import { playComboMilestone } from '../composables/useAudio';

const session = useSessionStore();

const showMilestone = ref(false);
let ms: number | null = null;

watch(
  () => session.comboMilestoneKey,
  () => {
    if (session.comboMilestone === 0) return;
    showMilestone.value = true;
    playComboMilestone();
    if (ms) window.clearTimeout(ms);
    ms = window.setTimeout(() => (showMilestone.value = false), 1400);
  },
);

const comboTier = computed(() => {
  if (session.combo >= 20) return 'neon';
  if (session.combo >= 10) return 'magenta';
  if (session.combo >= 5) return 'cyan';
  return '';
});
</script>

<template>
  <div class="combo-wrap">
    <div class="combo" :class="comboTier" data-testid="combo-counter">
      <span class="mono-caps">Combo</span>
      <span class="value glow">×{{ session.combo }}</span>
    </div>
    <transition name="milestone">
      <div v-if="showMilestone" class="milestone glow" data-testid="combo-milestone">
        ×{{ session.comboMilestone }} COMBO!
      </div>
    </transition>
  </div>
</template>

<style scoped>
.combo-wrap {
  position: relative;
}
.combo {
  display: flex;
  align-items: baseline;
  gap: 0.55rem;
  padding: 0.35rem 0.75rem;
  background: rgba(17, 22, 36, 0.8);
  border: 1px solid var(--border);
  border-radius: 4px;
}
.combo .value {
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--text-dim);
  transition: color 0.2s;
}
.combo.cyan .value {
  color: var(--cyan);
}
.combo.magenta .value {
  color: var(--magenta);
}
.combo.neon .value {
  color: var(--neon);
}
.milestone {
  position: absolute;
  left: 50%;
  top: 120%;
  transform: translateX(-50%);
  white-space: nowrap;
  color: var(--neon);
  font-size: 1.4rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  pointer-events: none;
}
.milestone-enter-active,
.milestone-leave-active {
  transition: opacity 0.35s ease, transform 0.35s ease;
}
.milestone-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-12px);
}
.milestone-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}
</style>
