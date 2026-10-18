<script setup lang="ts">
import { computed } from 'vue';
import { numberFormat, t, type MessageKey } from '../i18n';
import type { RevealState } from '../timeline';
import type { EvaluationResult, ProfileDefinition } from '../types/contracts';
import { buildCheckRows, failedCheckNames } from '../viewModel';

const props = defineProps<{
  evaluation: EvaluationResult | null;
  evaluating: boolean;
  reveal: RevealState;
  profiles: ProfileDefinition[];
  selectedProfile: string | null;
  showProfilePicker: boolean;
}>();

const emit = defineEmits<{
  (e: 'changeProfile', name: string): void;
}>();

const rows = computed(() => (props.evaluation ? buildCheckRows(props.evaluation, t, (n) => numberFormat.value.format(n)) : []));

const verdict = computed(() => props.evaluation?.verdict ?? null);
const tone = computed(() => {
  if (!verdict.value) return 'idle';
  if (verdict.value === 'CONFORMANT') return 'good';
  if (verdict.value === 'CONFORMANT_WITH_FINDINGS') return 'warn';
  return 'bad';
});
const verdictLabel = computed(() => (verdict.value ? t(`verdict.${verdict.value}` as MessageKey) : ''));
const verdictSub = computed(() => {
  if (!props.evaluation || !verdict.value) return '';
  if (verdict.value === 'NON_CONFORMANT') {
    const failed = failedCheckNames(props.evaluation, t);
    if (failed.length > 0) return t('verdict.failedChecks', { checks: failed.join(', ') });
  }
  return t(`verdict.sub${verdict.value}` as MessageKey);
});

const oneDecimal = computed(
  () => new Intl.NumberFormat(numberFormat.value.resolvedOptions().locale, { maximumFractionDigits: 1 }),
);
const latency = computed(() =>
  props.evaluation ? oneDecimal.value.format(props.evaluation.evaluation_duration_ms * props.reveal.latencyProgress) : '',
);

function rowState(index: number, passed: boolean): string {
  if (index >= props.reveal.checksShown) return 'pending';
  return passed ? 'pass' : 'fail';
}
function rowStatusText(index: number, passed: boolean, severity: string): string {
  if (index >= props.reveal.checksShown) return t('check.pending');
  if (passed) return t('check.passed');
  return severity === 'advisory' ? t('check.advisory') : t('check.failed');
}
</script>

<template>
  <section class="card contract" :class="[`tone-${reveal.verdictVisible ? tone : 'idle'}`]" aria-labelledby="contract-title">
    <header class="card-head">
      <span class="step" aria-hidden="true">3</span>
      <div class="titles">
        <h2 id="contract-title">{{ t('contract.title') }}</h2>
        <p class="sub">{{ t('contract.subtitle') }}</p>
      </div>
      <label v-if="showProfilePicker && profiles.length > 0 && evaluation" class="profile">
        <span class="label">{{ t('contract.profile') }}</span>
        <select :value="selectedProfile || evaluation.applied_profile.name" @change="emit('changeProfile', ($event.target as HTMLSelectElement).value)">
          <option v-for="p in profiles" :key="p.id" :value="p.name">{{ t(`category.${p.name}` as MessageKey) }}</option>
        </select>
      </label>
    </header>

    <p v-if="!evaluation" class="empty">{{ evaluating ? t('contract.evaluating') : t('contract.waiting') }}</p>

    <template v-else>
      <ul class="checks">
        <li v-for="(row, i) in rows" :key="row.name" class="check" :class="rowState(i, row.passed)">
          <span class="mark" aria-hidden="true">{{ i >= reveal.checksShown ? '' : row.passed ? '✓' : '✕' }}</span>
          <span class="name">{{ row.label }}</span>
          <span class="figures">
            <template v-if="i < reveal.checksShown">{{ row.figures }}</template>
          </span>
          <span class="sr-only">{{ rowStatusText(i, row.passed, row.severity) }}</span>
        </li>
      </ul>

      <div class="verdict" :class="{ visible: reveal.verdictVisible }">
        <p class="badge">
          <span class="badge-icon" aria-hidden="true">{{ tone === 'good' || tone === 'warn' ? '✓' : '✕' }}</span>
          <span>{{ verdictLabel }}</span>
        </p>
        <p class="verdict-sub">{{ verdictSub }}</p>
      </div>
      <p class="sr-only" role="status" aria-live="polite">
        {{ reveal.verdictVisible ? t('verdict.announce', { verdict: verdictLabel }) : '' }}
      </p>

      <p class="meta" :class="{ visible: reveal.latencyProgress > 0 }">
        <span class="latency">{{ t('contract.latency', { ms: latency }) }}</span>
        <span class="hash"><span class="label">{{ t('contract.hash') }}</span> {{ evaluation.asset_sha256.slice(0, 16) }}</span>
      </p>
    </template>
  </section>
</template>

<style scoped>
.card-head {
  display: flex;
  align-items: center;
  gap: var(--gap);
  flex-wrap: wrap;
}
.titles {
  flex: 1 1 auto;
}
.step {
  display: grid;
  place-items: center;
  flex: none;
  width: calc(var(--fs-title) * 1.5);
  height: calc(var(--fs-title) * 1.5);
  border-radius: var(--nain-radius);
  background: var(--nain-blue);
  color: var(--nain-paper);
  font: 700 var(--fs-label) var(--nain-font-mono);
}
h2 {
  font: 800 var(--fs-title) var(--nain-font-sans);
  letter-spacing: var(--nain-track-h1);
  line-height: 1.1;
}
.sub {
  font: 500 var(--fs-label) var(--nain-font-sans);
  color: var(--nain-blue-soft);
}
.label {
  font: 600 var(--fs-label) var(--nain-font-mono);
  letter-spacing: var(--nain-track-label);
  text-transform: uppercase;
  color: var(--nain-blue-soft);
}
.profile {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.profile select {
  min-height: 36px;
  padding: 0 0.5rem;
  border: 2px solid var(--nain-brand-black);
  border-radius: var(--nain-radius);
  background: var(--nain-surface);
  font: 600 0.85rem var(--nain-font-sans);
  color: var(--nain-brand-black);
}
.empty {
  margin-top: var(--gap);
  font: 500 var(--fs-body) var(--nain-font-sans);
  color: var(--nain-blue-soft);
}
.checks {
  list-style: none;
  margin: var(--gap) 0;
  display: grid;
  gap: calc(var(--gap) * 0.5);
}
.check {
  display: grid;
  grid-template-columns: calc(var(--fs-body) * 1.6) 1fr auto;
  align-items: center;
  gap: calc(var(--gap) * 0.6);
  padding: calc(var(--gap) * 0.5) calc(var(--gap) * 0.7);
  border-radius: var(--nain-radius);
  border: 2px solid var(--nain-line);
  background: var(--nain-surface);
  font: 600 var(--fs-body) var(--nain-font-sans);
  color: var(--nain-brand-black);
  transition: background 0.25s ease, border-color 0.25s ease;
}
.mark {
  display: grid;
  place-items: center;
  width: calc(var(--fs-body) * 1.5);
  height: calc(var(--fs-body) * 1.5);
  border-radius: 50%;
  border: 2px solid var(--nain-line);
  font: 800 var(--fs-body) var(--nain-font-sans);
  line-height: 1;
}
.figures {
  font: 500 var(--fs-label) var(--nain-font-mono);
  color: var(--nain-blue-deep);
}
.check.pass {
  border-color: var(--nain-green-ink);
}
.check.pass .mark {
  background: var(--nain-green);
  border-color: var(--nain-green-ink);
  color: var(--nain-brand-black);
}
.check.fail {
  border-color: var(--nain-red-ink);
  background: #fff1f2;
}
.check.fail .mark {
  background: var(--nain-red-ink);
  border-color: var(--nain-red-ink);
  color: #fff;
}
.check.fail .figures {
  color: var(--nain-red-ink);
}
.verdict {
  display: grid;
  gap: calc(var(--gap) * 0.4);
  padding: var(--gap);
  border-radius: var(--nain-radius);
  background: var(--nain-surface-sunken);
  opacity: 0; /* Hidden until the reveal: a dimmed verdict would spoil the outcome. */
  transform: scale(0.97);
  transition: opacity 0.3s ease, transform 0.45s cubic-bezier(0.2, 1.5, 0.4, 1);
}
.verdict.visible {
  opacity: 1;
  transform: scale(1);
}
.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5em;
  justify-self: start;
  padding: 0.15em 0.7em 0.15em 0.5em;
  border-radius: var(--nain-cap);
  font: 800 var(--fs-verdict) var(--nain-font-sans);
  letter-spacing: var(--nain-track-h1);
  line-height: 1.2;
  background: var(--nain-line);
  color: var(--nain-brand-black);
}
.tone-good .badge {
  background: var(--nain-green);
  color: var(--nain-brand-black);
}
.tone-warn .badge {
  background: #ffd23f;
  color: var(--nain-brand-black);
}
.tone-bad .badge {
  background: var(--nain-red-ink);
  color: #fff;
}
.verdict-sub {
  font: 600 var(--fs-body) var(--nain-font-sans);
  color: var(--nain-brand-black);
}
.meta {
  display: flex;
  justify-content: space-between;
  gap: var(--gap);
  margin-top: var(--gap);
  font: 500 var(--fs-label) var(--nain-font-mono);
  color: var(--nain-blue-deep);
  opacity: 0;
  transition: opacity 0.3s ease;
}
.meta.visible {
  opacity: 1;
}
.latency {
  font-weight: 700;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
