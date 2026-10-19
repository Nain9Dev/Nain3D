import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { es } from '../i18n/es';
import { CONTACTS, IDENTITY } from './contacts';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));

describe('contact catalogue', () => {
  it('lists exactly the four agreed contacts, in order', () => {
    expect(CONTACTS.map((c) => c.id)).toEqual(['site', 'email', 'linkedin', 'github']);
  });

  it('uses the NainDev public email and https links', () => {
    const email = CONTACTS.find((c) => c.id === 'email');
    expect(email?.value).toBe('contact@naindev.com');
    expect(email?.href).toBe('mailto:contact@naindev.com');
    for (const c of CONTACTS.filter((x) => x.id !== 'email')) expect(c.href).toMatch(/^https:\/\//);
  });

  it('points to the current repository, not the retired name', () => {
    const github = CONTACTS.find((c) => c.id === 'github');
    expect(github?.href).toBe('https://github.com/Nain9Dev/Nain3D');
  });

  it('gives every contact a short label and a readable value', () => {
    for (const c of CONTACTS) {
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.value.length).toBeLessThanOrEqual(34); // Fits one line on a 1080 px wide card.
    }
  });

  it('identifies the owner and the brand', () => {
    expect(IDENTITY).toEqual({ name: 'Aitor Nain', brand: 'NainDev' });
  });

  it('has the headline in both languages', () => {
    expect(es['cta.headline']).toBe('Arquitecto de software full stack');
    expect(en['cta.headline']).toBe('Full stack software architect');
  });

  it('never ships a personal address or the retired repository link', () => {
    const offenders = walk(SRC)
      .filter((f) => /\.(ts|vue)$/.test(f) && !f.endsWith('.test.ts'))
      .filter((f) => /gmail\.com|3d-ai-conformance-demo/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
