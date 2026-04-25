<script setup lang="ts">
import { computed, ref } from 'vue';
import SceneImladris from './scenes/SceneImladris.vue';
import SceneLothlorien from './scenes/SceneLothlorien.vue';
import SceneHostOfTheWest from './scenes/SceneHostOfTheWest.vue';
import SceneErynLasgalen from './scenes/SceneErynLasgalen.vue';

const scenes = [
  { name: 'Imladris', component: SceneImladris },
  { name: 'Lothlórien', component: SceneLothlorien },
  { name: 'Host of the West', component: SceneHostOfTheWest },
  { name: 'Eryn Lasgalen', component: SceneErynLasgalen },
] as const;

const props = defineProps<{ name?: string }>();

// Pick once at component mount; stays stable for the session.
const initialIndex = Math.floor(Math.random() * scenes.length);
const index = ref(initialIndex);

const active = computed(() => {
  if (props.name) {
    const found = scenes.findIndex((s) => s.name === props.name);
    if (found >= 0) return scenes[found];
  }
  return scenes[index.value];
});
</script>

<template>
  <div class="scene-host" aria-hidden="true">
    <component :is="active.component" />
    <div class="scene-label mono-caps">{{ active.name }}</div>
  </div>
</template>

<style scoped>
.scene-host {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}
.scene-label {
  position: fixed;
  bottom: 8px;
  right: 14px;
  color: var(--text-mute);
  opacity: 0.55;
  font-size: 0.62rem;
  letter-spacing: 0.32em;
  pointer-events: none;
}
</style>
