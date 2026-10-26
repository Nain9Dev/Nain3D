import { computed, ref } from 'vue';
import { en } from './en';
import { es, type MessageKey } from './es';

export type Lang = 'es' | 'en';
export type { MessageKey };

export const LANG_STORAGE_KEY = 'nain3d.lang';
const CATALOGUES: Record<Lang, Record<MessageKey, string>> = { es, en };

type StorageReader = Pick<Storage, 'getItem'> | null;

function isLang(value: string | null | undefined): value is Lang {
  return value === 'es' || value === 'en';
}

/** Order: `?lang=` first, then the remembered choice, then Spanish (source language). */
export function resolveLang(search: string, storage: StorageReader): Lang {
  const fromUrl = new URLSearchParams(search).get('lang');
  if (isLang(fromUrl)) return fromUrl;
  try {
    const stored = storage?.getItem(LANG_STORAGE_KEY) ?? storage?.getItem('nain_locale');
    if (isLang(stored)) return stored;
  } catch {
    // Storage can be blocked (private mode, sandboxed frames); Spanish is the safe default.
  }
  return 'es';
}

export function translate(lang: Lang, key: MessageKey, params?: Record<string, string | number>): string {
  const template = CATALOGUES[lang][key] ?? es[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

function safeStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export const lang = ref<Lang>('es');

export function initLang(): void {
  lang.value = resolveLang(typeof window === 'undefined' ? '' : window.location.search, safeStorage());
  document.documentElement.lang = lang.value;
  rememberLang(lang.value);
}

function rememberLang(value: Lang): void {
  try {
    const s = safeStorage();
    s?.setItem(LANG_STORAGE_KEY, value);
    s?.setItem('nain_locale', value);
  } catch {
    // Not remembering is acceptable; the URL parameter still works.
  }
}

export function setLang(value: Lang): void {
  lang.value = value;
  document.documentElement.lang = value;
  rememberLang(value);
  const url = new URL(window.location.href);
  url.searchParams.set('lang', value);
  window.history.replaceState(null, '', url);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('nain:locale-change', { detail: { locale: value } }));
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('nain:locale-change', (event: Event) => {
    const custom = event as CustomEvent<{ locale?: Lang }>;
    const target = custom.detail?.locale;
    if (isLang(target) && lang.value !== target) {
      setLang(target);
    }
  });
}

/** Reactive translate function for templates and scripts. */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  return translate(lang.value, key, params);
}

export const numberFormat = computed(() => new Intl.NumberFormat(lang.value === 'es' ? 'es-ES' : 'en-GB'));
