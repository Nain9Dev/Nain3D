import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { es } from '../i18n/es';
import { SAMPLE_CREDITS, SAMPLE_IDS, creditLine } from './catalog';

const samplesDir = fileURLToPath(new URL('../../public/samples/', import.meta.url));

describe('sample catalogue', () => {
  it('has a GLB on disk for every sample', () => {
    for (const id of SAMPLE_IDS) expect(existsSync(`${samplesDir}${id}.glb`), id).toBe(true);
  });

  it('has a name and a detail in both languages for every sample', () => {
    for (const id of SAMPLE_IDS) {
      for (const key of [`sample.${id}`, `sample.${id}.detail`]) {
        expect(key in es, `es ${key}`).toBe(true);
        expect(key in en, `en ${key}`).toBe(true);
      }
    }
  });

  it('records author, licence and source for every credited sample', () => {
    const credited = Object.keys(SAMPLE_CREDITS);
    expect(credited.length).toBeGreaterThan(0);
    for (const credit of Object.values(SAMPLE_CREDITS)) {
      expect(credit.title).not.toBe('');
      expect(credit.author).not.toBe('');
      expect(credit.licenseUrl).toMatch(/^https:\/\/creativecommons\.org\//);
      expect(credit.sourceUrl).toMatch(/^https:\/\//);
    }
  });

  it('builds a short attribution line only for third-party models', () => {
    expect(creditLine('sample-industrial')).toBeNull();
    expect(creditLine('sample-shoe')).toBe('Materials Variants Shoe · Shopify · CC BY 4.0');
  });

  it('keeps every credited model listed in the pipeline sources', () => {
    const sources = JSON.parse(readFileSync(fileURLToPath(new URL('../../tools/model-sources.json', import.meta.url)), 'utf8'));
    const ids = sources.models.map((m: { id: string }) => m.id);
    for (const id of Object.keys(SAMPLE_CREDITS)) expect(ids).toContain(id);
  });
});
