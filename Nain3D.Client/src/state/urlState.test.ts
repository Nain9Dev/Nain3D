import { describe, expect, it } from 'vitest';
import { parseUrlState } from './urlState';

describe('parseUrlState', () => {
  it('defaults to the standard mode', () => {
    expect(parseUrlState('')).toEqual({
      mode: 'standard',
      sample: null,
      clock: 'auto',
      format: 'auto',
      sequence: false,
    });
  });

  it('enables recording mode with the two-sample sequence by default', () => {
    const state = parseUrlState('?mode=record');
    expect(state.mode).toBe('record');
    expect(state.sequence).toBe(true);
  });

  it('plays a single sample when one is requested', () => {
    const state = parseUrlState('?mode=record&sample=sample-chair');
    expect(state.sample).toBe('sample-chair');
    expect(state.sequence).toBe(false);
  });

  it('accepts the manual clock used by the visual tests', () => {
    expect(parseUrlState('?mode=record&clock=manual').clock).toBe('manual');
  });

  it('accepts a forced format and rejects unknown values', () => {
    expect(parseUrlState('?format=vertical').format).toBe('vertical');
    expect(parseUrlState('?format=weird&mode=other').format).toBe('auto');
    expect(parseUrlState('?mode=other').mode).toBe('standard');
  });

  it('only accepts known sample ids', () => {
    expect(parseUrlState('?sample=../../etc').sample).toBeNull();
  });
});
