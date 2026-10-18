<script setup lang="ts">
import { lang, setLang, t, type Lang } from '../i18n';

// Each language is named in its own language, so the visible text is also the accessible name (WCAG 2.5.3).
const options: { value: Lang; label: 'app.languageEs' | 'app.languageEn' }[] = [
  { value: 'es', label: 'app.languageEs' },
  { value: 'en', label: 'app.languageEn' },
];
</script>

<template>
  <div class="lang-switch" role="group" :aria-label="t('app.language')">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="lang-btn"
      :class="{ active: lang === option.value }"
      :aria-pressed="lang === option.value"
      :lang="option.value"
      @click="setLang(option.value)"
    >
      {{ t(option.label) }}
    </button>
  </div>
</template>

<style scoped>
.lang-switch {
  display: inline-flex;
  border: 2px solid var(--nain-paper);
  border-radius: var(--nain-radius);
  overflow: hidden;
}
.lang-btn {
  min-height: 40px;
  padding: 0 1rem;
  font: 700 0.85rem var(--nain-font-sans);
  letter-spacing: 0.02em;
  color: var(--nain-paper);
  background: transparent;
  cursor: pointer;
}
.lang-btn.active {
  background: var(--nain-paper);
  color: var(--nain-brand-black);
}
.lang-btn:focus-visible {
  outline: 3px solid var(--nain-green);
  outline-offset: -3px;
}
</style>
