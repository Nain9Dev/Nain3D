<script setup lang="ts">
import { ref } from 'vue';
import { t, type MessageKey } from '../i18n';
import { SAMPLE_IDS, type SampleId } from '../state/urlState';

defineProps<{
  activeId: SampleId | null;
  busy: boolean;
  autoRotate: boolean;
  /** True when files never leave the browser (public site); shows the privacy line. */
  privacyNote: boolean;
}>();

const emit = defineEmits<{
  (e: 'select', id: SampleId): void;
  (e: 'compare'): void;
  (e: 'replay'): void;
  (e: 'upload', file: File): void;
  (e: 'update:autoRotate', value: boolean): void;
}>();

const fileInput = ref<HTMLInputElement | null>(null);

function onFile(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) emit('upload', file);
  (event.target as HTMLInputElement).value = '';
}
</script>

<template>
  <div class="picker">
    <div class="samples" role="group" :aria-label="t('actions.sampleSwitcher')">
      <button
        v-for="id in SAMPLE_IDS"
        :key="id"
        type="button"
        class="sample"
        :class="{ active: activeId === id, bad: id === 'sample-oversized-chair' }"
        :aria-pressed="activeId === id"
        :disabled="busy"
        @click="emit('select', id)"
      >
        <span class="sample-name">{{ t(`sample.${id}` as MessageKey) }}</span>
        <span class="sample-detail">{{ t(`sample.${id}.detail` as MessageKey) }}</span>
      </button>
    </div>

    <div class="tools">
      <button type="button" class="tool primary" :disabled="busy" :title="t('actions.shortcutHint')" @click="emit('compare')">
        {{ t('actions.compare') }}
      </button>
      <button type="button" class="tool" :disabled="busy" @click="emit('replay')">{{ t('actions.replay') }}</button>
      <button type="button" class="tool" @click="fileInput?.click()">{{ t('actions.upload') }}</button>
      <input ref="fileInput" class="file" type="file" accept=".glb,model/gltf-binary" tabindex="-1" aria-hidden="true" @change="onFile" />
      <label class="toggle">
        <input type="checkbox" :checked="autoRotate" @change="emit('update:autoRotate', ($event.target as HTMLInputElement).checked)" />
        <span>{{ t('actions.autoRotate') }}</span>
      </label>
    </div>
    <p v-if="privacyNote" class="privacy">{{ t('upload.privacy') }}</p>
  </div>
</template>

<style scoped>
.picker {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.75rem;
}
.samples,
.tools {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}
.sample,
.tool {
  min-height: 44px;
  padding: 0 0.9rem;
  border: 2px solid var(--nain-paper);
  border-radius: var(--nain-radius);
  background: transparent;
  color: var(--nain-paper);
  font: 700 0.85rem var(--nain-font-sans);
  cursor: pointer;
}
.sample {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  line-height: 1.15;
  padding: 0.3rem 0.9rem;
}
.sample-detail {
  font: 500 0.68rem var(--nain-font-mono);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--nain-green);
}
.sample.bad .sample-detail {
  color: #ff8a96;
}
.sample.active {
  background: var(--nain-paper);
  color: var(--nain-brand-black);
}
.sample.active .sample-detail {
  color: var(--nain-green-ink);
}
.sample.active.bad .sample-detail {
  color: var(--nain-red-ink);
}
.tool.primary {
  background: var(--nain-green);
  border-color: var(--nain-green);
  color: var(--nain-brand-black);
}
button:disabled {
  opacity: 0.55;
  cursor: progress;
}
button:focus-visible,
.toggle input:focus-visible {
  outline: 3px solid var(--nain-green);
  outline-offset: 2px;
}
.file {
  display: none;
}
.privacy {
  flex-basis: 100%;
  font: 500 0.78rem var(--nain-font-mono);
  color: #b9c6da;
}
.toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 44px;
  color: var(--nain-paper);
  font: 600 0.85rem var(--nain-font-sans);
}
.toggle input {
  width: 20px;
  height: 20px;
  accent-color: var(--nain-green);
}
</style>
