// Single list of bundled samples and the credits their licences require.
// Adding a model: put the GLB under public/samples, add its id here, its credit (if third-party), its
// name keys in i18n/es.ts and en.ts, and its entry in tools/model-sources.json when it is built from a source.
export const SAMPLE_IDS = [
  'sample-shoe',
  'sample-oversized-shoe',
  'sample-industrial',
  'sample-monitor',
  'sample-chair',
  'sample-oversized-chair',
] as const;
export type SampleId = (typeof SAMPLE_IDS)[number];

export interface SampleCredit {
  title: string;
  author: string;
  /** Short licence label shown in the credit line. */
  license: string;
  licenseUrl: string;
  sourceUrl: string;
}

const SHOE: SampleCredit = {
  title: 'Materials Variants Shoe',
  author: 'Shopify',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  sourceUrl: 'https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/MaterialsVariantsShoe',
};

/** Models made in this repository (procedural) need no credit. */
export const SAMPLE_CREDITS: Partial<Record<SampleId, SampleCredit>> = {
  'sample-shoe': SHOE,
  'sample-oversized-shoe': SHOE,
};

export function creditLine(id: SampleId | null): string | null {
  const credit = id ? SAMPLE_CREDITS[id] : undefined;
  return credit ? `${credit.title} · ${credit.author} · ${credit.license}` : null;
}
