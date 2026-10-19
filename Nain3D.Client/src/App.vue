<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { api, ApiError } from './services/api';
import type { EvaluationResult, ProfileDefinition } from './types/contracts';
import { lang, t, type MessageKey } from './i18n';
import { CONTACTS, IDENTITY } from './contact/contacts';
import { shouldUseBackend } from './services/backend';
import { MAX_UPLOAD_BYTES, validateUpload } from './upload/validateUpload';
import { creditLine } from './samples/catalog';
import { parseUrlState, type SampleId } from './state/urlState';
import { RECORD_SEQUENCE, recordStateAt, revealStateAt } from './timeline';
import { buildScaleOverlay } from './scene/overlay';
import { useClock } from './composables/useClock';
import { useReducedMotion } from './composables/useReducedMotion';
import AiProposalPanel from './components/AiProposalPanel.vue';
import ContractPanel from './components/ContractPanel.vue';
import LanguageSwitch from './components/LanguageSwitch.vue';
import SamplePicker from './components/SamplePicker.vue';
import StageView from './components/StageView.vue';

/** The tagline owns the first seconds of a recording, then clears the stage for the overlays. */
const HOOK_MS = 2600;
/** The pair used by the compare gesture and the first screen: same model, right and wrong scale. */
const HERO_CONFORMANT: SampleId = 'sample-shoe';
const HERO_NON_CONFORMANT: SampleId = 'sample-oversized-shoe';

const urlState = parseUrlState(window.location.search);
const isRecord = urlState.mode === 'record';
const reducedMotion = useReducedMotion();
const clock = useClock(urlState.clock);

const evaluation = ref<EvaluationResult | null>(null);
const modelBuffer = shallowRef<ArrayBuffer | null>(null);
const activeSampleId = ref<SampleId | null>(null);
const profiles = ref<ProfileDefinition[]>([]);
const selectedProfile = ref<string | null>(null);
const isEvaluating = ref(false);
const errorMessage = ref<string | null>(null);
const autoRotate = ref(true);
const revealOrigin = ref(0);
const ready = ref(false);
let uploadedFile: File | null = null;
let firstSettle = true;

const recordState = computed(() => recordStateAt(clock.now.value));
const cameraTimeMs = computed(() => (urlState.sequence ? recordState.value.localMs : clock.now.value));

const reveal = computed(() =>
  revealStateAt(
    clock.now.value - revealOrigin.value,
    evaluation.value?.checks.length ?? 4,
    reducedMotion.value,
  ),
);
const overlay = computed(() => (evaluation.value ? buildScaleOverlay(evaluation.value) : null));
const overlayVisible = computed(() => reveal.value.verdictVisible || reveal.value.checksShown >= 2);

const stageLabel = computed(() => {
  const name = activeSampleId.value ? t(`sample.${activeSampleId.value}` as MessageKey) : '';
  return `${t('stage.label')}${name ? `: ${name}` : ''}`;
});
const sampleName = computed(() =>
  activeSampleId.value ? t(`sample.${activeSampleId.value}` as MessageKey) : evaluation.value?.asset_name ?? '',
);
const credit = computed(() => creditLine(activeSampleId.value));
const portrait = ref(false);
function measureFormat(): void {
  portrait.value =
    urlState.format === 'vertical' || (urlState.format === 'auto' && window.innerHeight > window.innerWidth);
}
measureFormat();
const formatClass = computed(() => (isRecord ? (portrait.value ? 'portrait' : 'landscape') : ''));
const showDocsLink = shouldUseBackend();
const keepsFilesInBrowser = !shouldUseBackend();

function currentOrigin(): number {
  return urlState.sequence ? RECORD_SEQUENCE[recordState.value.index].startMs : clock.now.value;
}

async function toBuffer(blobUrl: string): Promise<ArrayBuffer> {
  const buffer = await (await fetch(blobUrl)).arrayBuffer();
  URL.revokeObjectURL(blobUrl);
  return buffer;
}

async function loadSample(id: SampleId): Promise<void> {
  isEvaluating.value = true;
  ready.value = false; // Set again once the new model is on screen.
  errorMessage.value = null;
  uploadedFile = null;
  activeSampleId.value = id;
  try {
    const { result, blobUrl } = await api.evaluateSample(id, selectedProfile.value || undefined);
    const buffer = await toBuffer(blobUrl);
    modelBuffer.value = buffer;
    evaluation.value = result;
    revealOrigin.value = currentOrigin();
  } catch (err: unknown) {
    errorMessage.value = err instanceof ApiError ? err.detail || err.message : String(err);
  } finally {
    isEvaluating.value = false;
  }
}

async function handleUpload(file: File): Promise<void> {
  const problem = validateUpload(file);
  if (problem) {
    errorMessage.value = t(`upload.${problem}` as MessageKey, { max: MAX_UPLOAD_BYTES / (1024 * 1024) });
    return;
  }
  isEvaluating.value = true;
  ready.value = false;
  errorMessage.value = null;
  uploadedFile = file;
  activeSampleId.value = null;
  try {
    modelBuffer.value = await file.arrayBuffer();
    evaluation.value = await api.evaluateFile(file, selectedProfile.value || undefined);
    revealOrigin.value = currentOrigin();
  } catch (err: unknown) {
    errorMessage.value = err instanceof ApiError ? err.detail || err.message : String(err);
  } finally {
    isEvaluating.value = false;
  }
}

async function handleProfileChange(name: string): Promise<void> {
  selectedProfile.value = name;
  if (uploadedFile) {
    evaluation.value = await api.evaluateFile(uploadedFile, name);
    revealOrigin.value = currentOrigin();
  } else if (activeSampleId.value) {
    await loadSample(activeSampleId.value);
  }
}

function toggleCompare(): void {
  const conformant = evaluation.value && evaluation.value.verdict !== 'NON_CONFORMANT';
  void loadSample(conformant ? HERO_NON_CONFORMANT : HERO_CONFORMANT);
}

function replay(): void {
  revealOrigin.value = clock.now.value;
}

function onSettled(buffer: ArrayBuffer): void {
  // Ignore frames drawn for a model that has already been replaced.
  if (buffer !== modelBuffer.value || isEvaluating.value) return;
  ready.value = true;
  if (isRecord && firstSettle) {
    firstSettle = false;
    clock.start();
  }
}

function onRenderFailed(): void {
  errorMessage.value = t('stage.renderFailed');
}

function onKeydown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null;
  if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
  if (event.key.toLowerCase() === 'c' && !event.ctrlKey && !event.metaKey && !event.altKey && !isRecord) {
    toggleCompare();
  }
}

watch(
  () => recordState.value.index,
  (index, previous) => {
    if (urlState.sequence && index !== previous) {
      evaluation.value = null;
      void loadSample(RECORD_SEQUENCE[index].sampleId);
    }
  },
);

watch(
  lang,
  () => {
    document.title = t('meta.title');
    document.querySelector('meta[name="description"]')?.setAttribute('content', t('meta.description'));
  },
  { immediate: true },
);

onMounted(async () => {
  window.addEventListener('keydown', onKeydown);
  window.addEventListener('resize', measureFormat);
  // Hooks for the visual tests; harmless in production.
  (window as unknown as { __nain: unknown }).__nain = {
    advance: (ms: number) => clock.advance(ms),
    now: () => clock.now.value,
  };
  if (!isRecord) clock.start();
  const first: SampleId = urlState.sample ?? (urlState.sequence ? RECORD_SEQUENCE[0].sampleId : HERO_CONFORMANT);
  void api.listProfiles().then((list) => {
    profiles.value = list;
  });
  await loadSample(first);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  window.removeEventListener('resize', measureFormat);
});
</script>

<template>
  <div
    class="app"
    :class="[isRecord ? 'is-record' : 'is-standard', formatClass]"
    :data-clock="clock.mode"
    :data-ready="ready ? 'true' : 'false'"
    :data-lang="lang"
  >
    <a v-if="!isRecord" class="skip-link" href="#main">{{ t('app.skipToContent') }}</a>

    <header v-if="!isRecord" class="topbar">
      <div class="brand">
        <h1>{{ t('app.name') }}</h1>
        <p>{{ t('app.tagline') }}</p>
      </div>
      <LanguageSwitch />
    </header>

    <main id="main" class="layout">
      <section class="stage-col" :aria-label="t('stage.label')">
        <div class="stage-frame">
          <StageView
            :model-buffer="modelBuffer"
            :overlay="overlay"
            :overlay-visible="overlayVisible"
            :label="stageLabel"
            :record="isRecord"
            :reduced-motion="reducedMotion"
            :auto-rotate="autoRotate"
            :time-ms="cameraTimeMs"
            :loading="isEvaluating && !modelBuffer"
            @file-selected="handleUpload"
            @settled="onSettled"
            @failed="onRenderFailed"
          />
          <div v-if="isRecord" class="hook" :class="{ faded: cameraTimeMs > HOOK_MS || (urlState.sequence && recordState.index > 0) }" aria-hidden="true">
            <p class="hook-name">{{ t('app.name') }}</p>
            <p class="hook-line">{{ t('app.tagline') }}</p>
          </div>
          <p class="sample-chip">{{ sampleName }}</p>
          <p v-if="credit" class="credit">{{ t('credit.model', { credit }) }}</p>
        </div>
        <SamplePicker
          v-if="!isRecord"
          v-model:auto-rotate="autoRotate"
          :active-id="activeSampleId"
          :busy="isEvaluating"
          :privacy-note="keepsFilesInBrowser"
          @select="loadSample"
          @compare="toggleCompare"
          @replay="replay"
          @upload="handleUpload"
        />
      </section>

      <section class="side-col">
        <p v-if="errorMessage" class="error" role="alert">
          {{ t('status.error') }} {{ t('status.errorDetail', { detail: errorMessage }) }}
        </p>
        <AiProposalPanel :proposal="evaluation?.ai_proposal ?? null" :visible="reveal.aiVisible" />
        <ContractPanel
          :evaluation="evaluation"
          :evaluating="isEvaluating"
          :reveal="reveal"
          :profiles="profiles"
          :selected-profile="selectedProfile"
          :show-profile-picker="!isRecord"
          @change-profile="handleProfileChange"
        />
      </section>
    </main>

    <footer v-if="!isRecord" class="footbar">
      <span>{{ t('footer.stack') }}</span>
      <nav :aria-label="t('footer.contact')">
        <a v-if="showDocsLink" href="http://localhost:8104/docs" target="_blank" rel="noopener noreferrer">{{ t('footer.api') }}</a>
        <a
          v-for="contact in CONTACTS"
          :key="contact.id"
          :href="contact.href"
          :target="contact.id === 'email' ? undefined : '_blank'"
          rel="noopener noreferrer"
        >{{ contact.id === 'email' ? contact.value : contact.label }}</a>
      </nav>
    </footer>

    <div v-if="isRecord && recordState.endCard" class="endcard">
      <p class="endcard-line">{{ t('record.endCard') }}</p>
      <p class="endcard-name">{{ IDENTITY.name }}</p>
      <p class="endcard-title">{{ t('cta.headline') }} · {{ IDENTITY.brand }}</p>
      <p class="endcard-lead">{{ t('cta.lead') }}</p>
      <ul class="endcard-contacts">
        <li v-for="contact in CONTACTS" :key="contact.id">
          <span class="endcard-label">{{ contact.label }}</span>
          <span class="endcard-value">{{ contact.value }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>
