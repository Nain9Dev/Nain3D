<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { numberFormat, t, type MessageKey } from '../i18n';
import {
  AUTO_PROFILE,
  MAX_PROFILES,
  defaultProfile,
  formFromProfile,
  profileFromForm,
  type ProfileForm,
} from '../profiles/profileStore';
import type { ProfileDefinition } from '../types/contracts';

const props = defineProps<{
  open: boolean;
  builtIn: ProfileDefinition[];
  custom: ProfileDefinition[];
  activeId: string;
  canAdd: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'select', id: string): void;
  (e: 'save', profile: ProfileDefinition): void;
  (e: 'remove', id: string): void;
  (e: 'duplicate', id: string): void;
}>();

type Mode = 'list' | 'form';
const dialog = ref<HTMLDialogElement | null>(null);
const mode = ref<Mode>('list');
const editingId = ref<string | null>(null);
const isNew = ref(false);
const form = ref<ProfileForm>(formFromProfile(defaultProfile('')));
const errors = ref<string[]>([]);
const pendingDelete = ref<string | null>(null);

const numericFields = [
  { key: 'max_triangles', optional: false },
  { key: 'max_dimension_m', optional: false },
  { key: 'max_degenerate_faces', optional: false },
  { key: 'max_file_mb', optional: true },
  { key: 'max_texture_px', optional: true },
  { key: 'max_materials', optional: true },
] as const;

const deleting = computed(() => props.custom.find((p) => p.id === pendingDelete.value) ?? null);

watch(
  () => props.open,
  async (open) => {
    const el = dialog.value;
    if (!el) return;
    if (open && !el.open) {
      mode.value = 'list';
      pendingDelete.value = null;
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
    await nextTick();
  },
);

function startNew(): void {
  isNew.value = true;
  editingId.value = defaultProfile('').id;
  form.value = formFromProfile(defaultProfile(t('profiles.defaultName')));
  errors.value = [];
  mode.value = 'form';
}

function startEdit(profile: ProfileDefinition): void {
  isNew.value = false;
  editingId.value = profile.id;
  form.value = formFromProfile(profile);
  errors.value = [];
  mode.value = 'form';
}

function submit(): void {
  const result = profileFromForm(form.value, editingId.value ?? '');
  errors.value = result.errors;
  if (!result.profile) return;
  emit('save', result.profile);
  mode.value = 'list';
}

function chips(p: ProfileDefinition): string[] {
  const n = (v: number) => numberFormat.value.format(v);
  const out: string[] = [];
  if (p.is_watertight_required) out.push(t('profiles.chipWatertight'));
  if (p.max_file_mb != null) out.push(t('profiles.chipFile', { n: n(p.max_file_mb) }));
  if (p.max_texture_px != null) out.push(t('profiles.chipTexture', { n: n(p.max_texture_px) }));
  if (p.max_materials != null) out.push(t('profiles.chipMaterials', { n: n(p.max_materials) }));
  if (p.require_uv_and_textures) out.push(t('profiles.chipUv'));
  return out;
}

const summary = (p: ProfileDefinition) =>
  t('profiles.summary', { triangles: numberFormat.value.format(p.max_triangles), dimension: numberFormat.value.format(p.max_dimension_m) });

const hasError = (field: string) => errors.value.includes(field);
const errorText = (field: string) => t(`profile.error.${field}` as MessageKey);
</script>

<template>
  <dialog ref="dialog" class="dialog" aria-labelledby="profiles-title" @close="emit('close')" @cancel="emit('close')">
    <header class="head">
      <h2 id="profiles-title">{{ mode === 'form' ? t(isNew ? 'profiles.formNew' : 'profiles.formEdit') : t('profiles.title') }}</h2>
      <button v-if="mode === 'list'" type="button" class="btn ghost" @click="emit('close')">{{ t('profiles.close') }}</button>
    </header>

    <div v-if="mode === 'list'" class="body">
      <ul class="list" :aria-label="t('profiles.builtIn')">
        <li class="row">
          <div class="info">
            <strong>{{ t('profiles.auto') }}</strong>
          </div>
          <button type="button" class="btn" :disabled="activeId === AUTO_PROFILE" @click="emit('select', AUTO_PROFILE)">
            {{ activeId === AUTO_PROFILE ? t('profiles.inUse') : t('profiles.use') }}
          </button>
        </li>
        <li v-for="p in builtIn" :key="p.id" class="row">
          <div class="info">
            <strong>{{ t(`category.${p.name}` as MessageKey) }}</strong>
            <span class="meta">{{ summary(p) }}</span>
          </div>
          <button type="button" class="btn" :disabled="activeId === p.id" @click="emit('select', p.id)">
            {{ activeId === p.id ? t('profiles.inUse') : t('profiles.use') }}
          </button>
        </li>
      </ul>

      <h3 class="section">{{ t('profiles.mine') }}</h3>
      <p v-if="custom.length === 0" class="note">{{ t('profiles.empty') }}</p>
      <ul v-else class="list" :aria-label="t('profiles.mine')">
        <li v-for="p in custom" :key="p.id" class="row custom">
          <div class="info">
            <strong>{{ p.name }}</strong>
            <span class="meta">{{ summary(p) }}</span>
            <span class="chips"><span v-for="chip in chips(p)" :key="chip" class="chip">{{ chip }}</span></span>
          </div>
          <div class="actions">
            <button type="button" class="btn" :disabled="activeId === p.id" @click="emit('select', p.id)">
              {{ activeId === p.id ? t('profiles.inUse') : t('profiles.use') }}
            </button>
            <button type="button" class="btn" :aria-label="`${t('profiles.edit')}: ${p.name}`" @click="startEdit(p)">{{ t('profiles.edit') }}</button>
            <button type="button" class="btn" :disabled="!canAdd" :aria-label="`${t('profiles.duplicate')}: ${p.name}`" @click="emit('duplicate', p.id)">
              {{ t('profiles.duplicate') }}
            </button>
            <button type="button" class="btn danger" :aria-label="`${t('profiles.delete')}: ${p.name}`" @click="pendingDelete = p.id">
              {{ t('profiles.delete') }}
            </button>
          </div>
        </li>
      </ul>

      <div v-if="deleting" class="confirm" role="alertdialog" aria-labelledby="confirm-text">
        <p id="confirm-text">{{ t('profiles.deleteConfirm', { name: deleting.name }) }}</p>
        <button type="button" class="btn danger" @click="emit('remove', deleting.id); pendingDelete = null">{{ t('profiles.deleteYes') }}</button>
        <button type="button" class="btn" @click="pendingDelete = null">{{ t('profiles.cancel') }}</button>
      </div>

      <div class="foot">
        <button type="button" class="btn primary" :disabled="!canAdd" @click="startNew">{{ t('profiles.new') }}</button>
        <p class="note">{{ canAdd ? t('profiles.onDevice') : t('profiles.limitReached', { max: MAX_PROFILES }) }}</p>
      </div>
    </div>

    <form v-else class="body form" novalidate @submit.prevent="submit">
      <p v-if="errors.length > 0" class="alert" role="alert">{{ t('profiles.errorsFound') }}</p>

      <div class="field">
        <label for="pf-name">{{ t('profile.name') }}</label>
        <input id="pf-name" v-model="form.name" type="text" maxlength="80" :aria-invalid="hasError('name')" :aria-describedby="hasError('name') ? 'pf-name-err' : undefined" />
        <p v-if="hasError('name')" id="pf-name-err" class="error">{{ errorText('name') }}</p>
      </div>
      <div class="field">
        <label for="pf-description">{{ t('profile.description') }}</label>
        <input id="pf-description" v-model="form.description" type="text" maxlength="300" :aria-invalid="hasError('description')" />
        <p v-if="hasError('description')" class="error">{{ errorText('description') }}</p>
      </div>

      <div v-for="field in numericFields" :key="field.key" class="field">
        <label :for="`pf-${field.key}`">{{ t(`profile.${field.key}` as MessageKey) }}</label>
        <input
          :id="`pf-${field.key}`"
          v-model="form[field.key]"
          type="text"
          inputmode="decimal"
          autocomplete="off"
          :aria-invalid="hasError(field.key)"
          :aria-describedby="`pf-${field.key}-help`"
        />
        <p :id="`pf-${field.key}-help`" class="hint" :class="{ error: hasError(field.key) }">
          {{ hasError(field.key) ? errorText(field.key) : field.optional ? t('profiles.optionalHint') : '' }}
        </p>
      </div>

      <label class="check"><input v-model="form.is_watertight_required" type="checkbox" /> {{ t('profile.is_watertight_required') }}</label>
      <label class="check"><input v-model="form.require_uv_and_textures" type="checkbox" /> {{ t('profile.require_uv_and_textures') }}</label>

      <div class="foot">
        <button type="submit" class="btn primary">{{ t('profiles.save') }}</button>
        <button type="button" class="btn" @click="mode = 'list'">{{ t('profiles.cancel') }}</button>
      </div>
    </form>
  </dialog>
</template>

<style scoped>
.dialog {
  margin: auto; /* The global reset removes the default centring of a modal dialog. */
  width: min(640px, calc(100vw - 2rem));
  max-height: calc(100vh - 2rem);
  padding: 0;
  border: 3px solid var(--nain-brand-black);
  border-radius: var(--nain-radius);
  background: var(--nain-paper);
  color: var(--nain-brand-black);
  box-shadow: 10px 10px 0 var(--nain-blue);
  overflow: auto;
}
.dialog::backdrop {
  background: rgba(12, 18, 34, 0.8);
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 2px solid var(--nain-line);
}
h2 {
  font: 800 1.25rem var(--nain-font-sans);
}
.section {
  margin: 1.25rem 0 0.5rem;
  font: 700 1rem var(--nain-font-sans);
}
.body {
  padding: 1rem 1.25rem 1.25rem;
}
.list {
  list-style: none;
  display: grid;
  gap: 0.5rem;
}
.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1rem;
  padding: 0.6rem 0.75rem;
  border: 2px solid var(--nain-line);
  border-radius: var(--nain-radius);
  background: var(--nain-surface);
}
.info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}
.meta,
.note,
.hint {
  font: 500 0.82rem var(--nain-font-mono);
  color: var(--nain-blue-deep);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}
.chip {
  padding: 0.05rem 0.5rem;
  border-radius: var(--nain-cap);
  background: var(--nain-surface-sunken);
  font: 600 0.75rem var(--nain-font-mono);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.btn {
  min-height: 44px;
  padding: 0 0.9rem;
  border: 2px solid var(--nain-brand-black);
  border-radius: var(--nain-radius);
  background: var(--nain-surface);
  color: var(--nain-brand-black);
  font: 700 0.85rem var(--nain-font-sans);
  cursor: pointer;
}
.btn.primary {
  background: var(--nain-green);
}
.btn.danger {
  border-color: var(--nain-red-ink);
  color: var(--nain-red-ink);
}
.btn.ghost {
  border-color: transparent;
  text-decoration: underline;
}
.btn:disabled {
  opacity: 0.55;
  cursor: default;
}
.btn:focus-visible,
input:focus-visible {
  outline: 3px solid var(--nain-blue);
  outline-offset: 2px;
}
.confirm {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
  padding: 0.75rem;
  border: 2px solid var(--nain-red-ink);
  border-radius: var(--nain-radius);
  background: #fff1f2;
}
.confirm p {
  flex: 1 1 100%;
  font-weight: 600;
}
.foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1.25rem;
}
.form {
  display: grid;
  gap: 0.75rem;
}
.field {
  display: grid;
  gap: 0.2rem;
}
.field label {
  font: 700 0.9rem var(--nain-font-sans);
}
.field input[type='text'] {
  min-height: 44px;
  padding: 0 0.6rem;
  border: 2px solid var(--nain-brand-black);
  border-radius: var(--nain-radius);
  background: #fff;
  font: 500 1rem var(--nain-font-mono);
  color: var(--nain-brand-black);
}
.field input[aria-invalid='true'] {
  border-color: var(--nain-red-ink);
  background: #fff1f2;
}
.check {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-height: 44px;
  font: 600 0.95rem var(--nain-font-sans);
}
.check input {
  width: 22px;
  height: 22px;
  accent-color: var(--nain-blue);
}
.error {
  color: var(--nain-red-ink);
  font-weight: 700;
}
.alert {
  padding: 0.6rem 0.75rem;
  border-radius: var(--nain-radius);
  background: var(--nain-red-ink);
  color: #fff;
  font-weight: 700;
}
</style>
