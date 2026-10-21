<script setup lang="ts">
import { ref, watch } from 'vue';
import { t } from '../i18n';

const props = defineProps<{
  open: boolean;
  busy: boolean;
  /** 'ok' after a report was created, 'error' when it could not be, null otherwise. */
  outcome: 'ok' | 'error' | null;
  company: string;
  reference: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'create', fields: { company: string; reference: string }): void;
}>();

const dialog = ref<HTMLDialogElement | null>(null);
const company = ref(props.company);
const reference = ref(props.reference);

watch(
  () => props.open,
  (open) => {
    const el = dialog.value;
    if (!el) return;
    if (open && !el.open) {
      company.value = props.company;
      reference.value = props.reference;
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  },
);
</script>

<template>
  <dialog ref="dialog" class="dialog" aria-labelledby="report-title" @close="emit('close')" @cancel="emit('close')">
    <form novalidate @submit.prevent="emit('create', { company, reference })">
      <h2 id="report-title">{{ t('report.dialogTitle') }}</h2>
      <p class="hint">{{ t('report.hint') }}</p>

      <div class="field">
        <label for="rp-company">{{ t('report.companyField') }}</label>
        <input id="rp-company" v-model="company" type="text" maxlength="80" autocomplete="organization" />
      </div>
      <div class="field">
        <label for="rp-reference">{{ t('report.referenceField') }}</label>
        <input id="rp-reference" v-model="reference" type="text" maxlength="80" autocomplete="off" />
      </div>

      <p v-if="outcome" class="outcome" :class="outcome" role="status">
        {{ outcome === 'ok' ? t('report.done') : t('report.failed') }}
      </p>

      <div class="foot">
        <button type="submit" class="btn primary" :disabled="busy">{{ t('report.create') }}</button>
        <button type="button" class="btn" @click="emit('close')">{{ t('profiles.close') }}</button>
      </div>
    </form>
  </dialog>
</template>

<style scoped>
.dialog {
  margin: auto; /* The global reset removes the default centring of a modal dialog. */
  width: min(520px, calc(100vw - 2rem));
  padding: 1.25rem;
  border: 3px solid var(--nain-brand-black);
  border-radius: var(--nain-radius);
  background: var(--nain-paper);
  color: var(--nain-brand-black);
  box-shadow: 10px 10px 0 var(--nain-blue);
}
.dialog::backdrop {
  background: rgba(12, 18, 34, 0.8);
}
h2 {
  font: 800 1.25rem var(--nain-font-sans);
}
.hint {
  margin: 0.4rem 0 1rem;
  font: 500 0.85rem var(--nain-font-mono);
  color: var(--nain-blue-deep);
}
.field {
  display: grid;
  gap: 0.2rem;
  margin-bottom: 0.75rem;
}
.field label {
  font: 700 0.9rem var(--nain-font-sans);
}
.field input {
  min-height: 44px;
  padding: 0 0.6rem;
  border: 2px solid var(--nain-brand-black);
  border-radius: var(--nain-radius);
  background: #fff;
  font: 500 1rem var(--nain-font-sans);
  color: var(--nain-brand-black);
}
.foot {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 1rem;
}
.btn {
  min-height: 44px;
  padding: 0 1rem;
  border: 2px solid var(--nain-brand-black);
  border-radius: var(--nain-radius);
  background: var(--nain-surface);
  color: var(--nain-brand-black);
  font: 700 0.9rem var(--nain-font-sans);
  cursor: pointer;
}
.btn.primary {
  background: var(--nain-green);
}
.btn:disabled {
  opacity: 0.55;
  cursor: progress;
}
.btn:focus-visible,
.field input:focus-visible {
  outline: 3px solid var(--nain-blue);
  outline-offset: 2px;
}
.outcome {
  padding: 0.5rem 0.75rem;
  border-radius: var(--nain-radius);
  font-weight: 700;
}
.outcome.ok {
  background: var(--nain-green);
}
.outcome.error {
  background: var(--nain-red-ink);
  color: #fff;
}
</style>
