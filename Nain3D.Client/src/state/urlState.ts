export type AppMode = 'standard' | 'record';
export type ClockMode = 'auto' | 'manual';
export type FormatMode = 'auto' | 'vertical' | 'horizontal';

export const SAMPLE_IDS = [
  'sample-monitor',
  'sample-chair',
  'sample-industrial',
  'sample-oversized-chair',
] as const;
export type SampleId = (typeof SAMPLE_IDS)[number];

export interface UrlState {
  mode: AppMode;
  sample: SampleId | null;
  clock: ClockMode;
  format: FormatMode;
  /** Recording mode plays the conformant then the non-conformant sample unless one sample is requested. */
  sequence: boolean;
}

function isSampleId(value: string | null): value is SampleId {
  return value !== null && (SAMPLE_IDS as readonly string[]).includes(value);
}

export function parseUrlState(search: string): UrlState {
  const params = new URLSearchParams(search);
  const mode: AppMode = params.get('mode') === 'record' ? 'record' : 'standard';
  const requested = params.get('sample');
  const sample = isSampleId(requested) ? requested : null;
  const format = params.get('format');
  return {
    mode,
    sample,
    clock: params.get('clock') === 'manual' ? 'manual' : 'auto',
    format: format === 'vertical' || format === 'horizontal' ? format : 'auto',
    sequence: mode === 'record' && sample === null,
  };
}
