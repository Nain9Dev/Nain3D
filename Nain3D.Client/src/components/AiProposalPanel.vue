<script setup lang="ts">
import { computed } from 'vue';
import { numberFormat, t, type MessageKey } from '../i18n';
import type { AiProposal } from '../types/contracts';

const props = defineProps<{
  proposal: AiProposal | null;
  visible: boolean;
}>();

const categoryLabel = computed(() => {
  if (!props.proposal) return '';
  const key = `category.${props.proposal.predicted_category}` as MessageKey;
  const translated = t(key);
  // Unknown categories fall back to the raw API value (translate returns the key itself).
  return translated === key ? props.proposal.predicted_category : translated;
});
const percent = computed(() => (props.proposal ? Math.round(props.proposal.confidence * 100) : 0));
</script>

<template>
  <section class="card ai" aria-labelledby="ai-title">
    <header class="card-head">
      <span class="step" aria-hidden="true">2</span>
      <div>
        <h2 id="ai-title">{{ t('ai.title') }}</h2>
        <p class="sub">{{ t('ai.subtitle') }}</p>
      </div>
    </header>

    <div class="body" :class="{ shown: visible && proposal }">
      <template v-if="proposal">
        <p class="label cat-label">{{ t('ai.category') }}</p>
        <p class="category">{{ categoryLabel }}</p>
        <div class="confidence">
          <span class="label">{{ t('ai.confidence') }}</span>
          <div
            class="meter"
            role="meter"
            :aria-label="t('ai.confidence')"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-valuenow="percent"
          >
            <div class="meter-fill" :style="{ width: visible ? `${percent}%` : '0%' }"></div>
          </div>
          <span class="percent">{{ numberFormat.format(percent) }}%</span>
        </div>
      </template>
      <p v-else class="empty">{{ t('ai.waiting') }}</p>
    </div>
  </section>
</template>

<style scoped>
.card-head {
  display: flex;
  align-items: center;
  gap: var(--gap);
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
.body {
  margin-top: var(--gap);
  opacity: 0;
  transition: opacity 0.4s ease;
}
.body.shown {
  opacity: 1;
}
.label {
  font: 600 var(--fs-label) var(--nain-font-mono);
  letter-spacing: var(--nain-track-label);
  text-transform: uppercase;
  color: var(--nain-blue-soft);
}
.category {
  margin: 0.15em 0 var(--gap);
  font: 800 var(--fs-category) var(--nain-font-sans);
  line-height: 1.05;
  color: var(--nain-blue-deep);
}
.confidence {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: var(--gap);
}
.meter {
  height: calc(var(--fs-label) * 0.8);
  border-radius: var(--nain-cap);
  background: var(--nain-surface-sunken);
  overflow: hidden;
}
.meter-fill {
  height: 100%;
  background: var(--nain-blue);
  transition: width 0.9s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.percent {
  font: 700 var(--fs-body) var(--nain-font-mono);
  color: var(--nain-brand-black);
}
.empty {
  font: 500 var(--fs-body) var(--nain-font-sans);
  color: var(--nain-blue-soft);
}
</style>
