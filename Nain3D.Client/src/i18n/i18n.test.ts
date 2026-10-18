import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { en } from './en';
import { es } from './es';
import { resolveLang, translate } from './index';

const SRC = fileURLToPath(new URL('..', import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

describe('catalogue parity', () => {
  it('has no missing English key', () => {
    const missing = Object.keys(es).filter((k) => !(k in en));
    expect(missing).toEqual([]);
  });

  it('has no extra English key', () => {
    const extra = Object.keys(en).filter((k) => !(k in es));
    expect(extra).toEqual([]);
  });

  it('keeps the same placeholders in both languages', () => {
    const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(es) as (keyof typeof es)[]) {
      expect(placeholders(en[key]), key).toEqual(placeholders(es[key]));
    }
  });

  it('has no empty translation', () => {
    for (const key of Object.keys(es) as (keyof typeof es)[]) {
      expect(es[key].trim(), `es ${key}`).not.toBe('');
      expect(en[key].trim(), `en ${key}`).not.toBe('');
    }
  });
});

describe('catalogue usage', () => {
  const sources = walk(SRC).filter((f) => /\.(vue|ts)$/.test(f) && !f.includes('.test.') && !f.includes(`${join('i18n', '')}`));

  it('only references keys that exist', () => {
    const used = new Set<string>();
    for (const file of sources) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/\bt\(\s*'([^']+)'/g)) used.add(m[1]);
    }
    const unknown = [...used].filter((k) => !(k in es) && !/\$\{/.test(k));
    expect(unknown).toEqual([]);
  });

  it('leaves no literal user-facing text in component templates', () => {
    const offenders: string[] = [];
    for (const file of sources.filter((f) => f.endsWith('.vue'))) {
      const template = /<template>([\s\S]*)<\/template>/.exec(readFileSync(file, 'utf8'))?.[1] ?? '';
      const withoutMustache = template.replace(/\{\{[\s\S]*?\}\}/g, '');
      for (const m of withoutMustache.matchAll(/>([^<>]*[A-Za-zÁ-ÿ]{2,}[^<>]*)</g)) {
        offenders.push(`${file}: text "${m[1].trim()}"`);
      }
      for (const m of withoutMustache.matchAll(/\s(aria-label|title|alt|placeholder)="([^"]*[A-Za-zÁ-ÿ]{2,}[^"]*)"/g)) {
        offenders.push(`${file}: ${m[1]}="${m[2]}"`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('language resolution', () => {
  const store = (value: string | null) => ({ getItem: () => value });

  it('defaults to Spanish', () => {
    expect(resolveLang('', store(null))).toBe('es');
  });

  it('honours ?lang=en over storage', () => {
    expect(resolveLang('?lang=en', store('es'))).toBe('en');
  });

  it('falls back to the remembered language', () => {
    expect(resolveLang('', store('en'))).toBe('en');
  });

  it('ignores unsupported values and a broken storage', () => {
    expect(resolveLang('?lang=fr', store('de'))).toBe('es');
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
    };
    expect(resolveLang('', throwing)).toBe('es');
  });
});

describe('translate', () => {
  it('interpolates placeholders', () => {
    expect(translate('es', 'contract.latency', { ms: 7 })).toBe('Evaluado en 7 ms');
    expect(translate('en', 'contract.latency', { ms: 7 })).toBe('Evaluated in 7 ms');
  });

  it('falls back to the Spanish source, then to the key', () => {
    expect(translate('en', 'no.such.key' as never)).toBe('no.such.key');
  });
});
