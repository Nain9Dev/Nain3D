<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { numberFormat, t } from '../i18n';
import type { Anchor, Stage } from '../scene/stage';
import type { ScaleOverlay } from '../scene/overlay';

const props = defineProps<{
  modelBuffer: ArrayBuffer | null;
  overlay: ScaleOverlay | null;
  overlayVisible: boolean;
  label: string;
  record: boolean;
  reducedMotion: boolean;
  autoRotate: boolean;
  /** Presentation clock in ms; drives the camera in recording mode. */
  timeMs: number;
  loading: boolean;
}>();

const emit = defineEmits<{
  (e: 'fileSelected', file: File): void;
  /** The model and overlay are in the scene and a frame has been drawn. */
  (e: 'settled', buffer: ArrayBuffer): void;
}>();

const root = ref<HTMLDivElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const anchors = ref<Anchor[]>([]);
const isDragging = ref(false);
let stage: Stage | null = null;
let queue: Promise<void> = Promise.resolve();

function sync(): void {
  const current = stage;
  if (!current) return;
  const buffer = props.modelBuffer;
  const overlay = props.overlayVisible ? props.overlay : null;
  queue = queue
    .then(async () => {
      if (buffer && buffer !== loadedBuffer) {
        loadedBuffer = buffer;
        await current.loadGlb(buffer.slice(0));
      }
      current.setOverlay(overlay);
      if (buffer) emit('settled', buffer);
    })
    .catch((error: unknown) => {
      // A model that cannot be parsed must not block later loads.
      console.error('Stage update failed', error);
    });
}
let loadedBuffer: ArrayBuffer | null = null;

// Drag-and-drop and arrow-key orbit are wired here so the template keeps plain, non-interactive semantics.
function wireInput(): () => void {
  const el = root.value;
  const cv = canvas.value;
  if (!el || !cv) return () => undefined;
  const over = (event: DragEvent) => {
    event.preventDefault();
    isDragging.value = true;
  };
  const leave = () => {
    isDragging.value = false;
  };
  el.addEventListener('dragover', over);
  el.addEventListener('dragleave', leave);
  el.addEventListener('drop', onDrop);
  cv.addEventListener('keydown', onKey);
  return () => {
    el.removeEventListener('dragover', over);
    el.removeEventListener('dragleave', leave);
    el.removeEventListener('drop', onDrop);
    cv.removeEventListener('keydown', onKey);
  };
}
let unwire: () => void = () => undefined;

onMounted(async () => {
  if (!canvas.value) return;
  unwire = wireInput();
  // three.js is loaded on demand so the interface paints before the 3D engine arrives.
  const { Stage } = await import('../scene/stage');
  if (!canvas.value) return;
  stage = new Stage(canvas.value, { record: props.record, reducedMotion: props.reducedMotion });
  stage.onAnchors = (list) => {
    anchors.value = list;
  };
  stage.setAutoRotate(props.autoRotate);
  sync();
});

onBeforeUnmount(() => {
  unwire();
  stage?.dispose();
});

watch(() => [props.modelBuffer, props.overlay, props.overlayVisible], sync);
watch(
  () => props.autoRotate,
  (value) => stage?.setAutoRotate(value),
);
watch(
  () => props.timeMs,
  (ms) => {
    if (props.record) stage?.setTime(ms);
  },
);

function anchorStyle(id: string): Record<string, string> | undefined {
  const a = anchors.value.find((item) => item.id === id);
  if (!a || !a.visible) return undefined;
  return { left: `${a.x}px`, top: `${a.y}px` };
}

function onDrop(event: DragEvent): void {
  event.preventDefault();
  isDragging.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (file && /\.(glb|gltf)$/i.test(file.name)) emit('fileSelected', file);
}

function onKey(event: KeyboardEvent): void {
  const step = 0.12;
  if (event.key === 'ArrowLeft') stage?.orbitBy(-step, 0);
  else if (event.key === 'ArrowRight') stage?.orbitBy(step, 0);
  else if (event.key === 'ArrowUp') stage?.orbitBy(0, step);
  else if (event.key === 'ArrowDown') stage?.orbitBy(0, -step);
  else return;
  event.preventDefault();
}
</script>

<template>
  <div ref="root" class="stage" role="group" :aria-label="label" :class="{ dragging: isDragging }">
    <canvas
      ref="canvas"
      class="stage-canvas"
      role="application"
      :aria-label="label"
      :tabindex="record ? -1 : 0"
    ></canvas>

    <div v-if="overlay && overlayVisible" class="labels" aria-hidden="true">
      <span v-if="anchorStyle('limit')" class="label limit" :style="anchorStyle('limit')">
        {{ t('stage.limitLabel', { limit: numberFormat.format(overlay.limit) }) }}
      </span>
      <span
        v-if="anchorStyle('model')"
        class="label model"
        :class="overlay.exceeds ? 'bad' : 'good'"
        :style="anchorStyle('model')"
      >
        {{ overlay.exceeds ? t('stage.exceeds') : t('stage.fits') }}
      </span>
      <template v-for="tick in overlay.ticks" :key="tick">
        <span v-if="anchorStyle(`tick:${tick}`)" class="label tick" :style="anchorStyle(`tick:${tick}`)">
          {{ t('stage.rulerUnit', { n: numberFormat.format(tick) }) }}
        </span>
      </template>
    </div>

    <p v-if="loading" class="stage-note" role="status">{{ t('stage.loading') }}</p>
    <p v-if="isDragging" class="stage-note drop">{{ t('stage.dropHint') }}</p>
  </div>
</template>

<style scoped>
.stage {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 280px;
  overflow: hidden;
}
.stage-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  touch-action: none;
}
.stage-canvas:focus-visible {
  outline: 3px solid var(--nain-green);
  outline-offset: -3px;
}
.labels {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.label {
  position: absolute;
  transform: translate(8px, -50%);
  font: 600 var(--label-size, 0.78rem) var(--nain-font-mono);
  letter-spacing: 0.04em;
  padding: 0.15em 0.5em;
  border-radius: 3px;
  white-space: nowrap;
  color: var(--nain-brand-black);
  background: var(--nain-paper);
}
.label.limit {
  transform: translate(-100%, -120%);
}
.label.model {
  transform: translate(-50%, -150%);
}
.label.model.bad {
  background: var(--nain-red-ink);
  color: #fff;
}
.label.model.good {
  background: var(--nain-green);
  color: var(--nain-brand-black);
}
.label.tick {
  background: transparent;
  color: var(--nain-paper);
  padding: 0 0.25em;
}
.stage-note {
  position: absolute;
  left: 50%;
  bottom: 1rem;
  transform: translateX(-50%);
  padding: 0.4rem 0.9rem;
  border-radius: var(--nain-radius);
  background: var(--nain-paper);
  color: var(--nain-brand-black);
  font: 600 0.85rem var(--nain-font-sans);
}
.stage-note.drop {
  inset: 1rem;
  transform: none;
  display: grid;
  place-items: center;
  border: 3px dashed var(--nain-green);
  background: rgba(0, 43, 102, 0.85);
  color: var(--nain-paper);
  font-size: 1.1rem;
}
</style>
