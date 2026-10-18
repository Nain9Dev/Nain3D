import { describe, expect, it } from 'vitest';
import { RECORD_SEQUENCE, RECORD_TOTAL_MS, recordStateAt, revealDuration, revealStateAt } from './timeline';

describe('revealStateAt', () => {
  it('starts empty', () => {
    expect(revealStateAt(0, 4, false)).toEqual({
      aiVisible: false,
      checksShown: 0,
      verdictVisible: false,
      latencyProgress: 0,
      done: false,
    });
  });

  it('marks the checks one by one, then the verdict, then the latency', () => {
    let previous = -1;
    for (let ms = 0; ms <= revealDuration(4); ms += 50) {
      const s = revealStateAt(ms, 4, false);
      expect(s.checksShown).toBeGreaterThanOrEqual(previous);
      previous = s.checksShown;
      if (s.verdictVisible) expect(s.checksShown).toBe(4);
      if (s.latencyProgress > 0) expect(s.verdictVisible).toBe(true);
    }
    const end = revealStateAt(revealDuration(4), 4, false);
    expect(end.done).toBe(true);
    expect(end.latencyProgress).toBe(1);
  });

  it('is deterministic for the same time', () => {
    expect(revealStateAt(2345, 4, false)).toEqual(revealStateAt(2345, 4, false));
  });

  it('shows everything at once when motion is reduced', () => {
    expect(revealStateAt(0, 4, true)).toEqual({
      aiVisible: true,
      checksShown: 4,
      verdictVisible: true,
      latencyProgress: 1,
      done: true,
    });
  });
});

describe('recordStateAt', () => {
  it('plays conformant first, then non-conformant, then the end card', () => {
    expect(RECORD_SEQUENCE.map((s) => s.sampleId)).toEqual(['sample-shoe', 'sample-oversized-shoe']);
    expect(recordStateAt(0)).toMatchObject({ index: 0, localMs: 0, endCard: false });
    const second = recordStateAt(RECORD_SEQUENCE[1].startMs + 100);
    expect(second).toMatchObject({ index: 1, localMs: 100, endCard: false });
    expect(recordStateAt(RECORD_TOTAL_MS - 1).endCard).toBe(true);
  });

  it('stays under thirty seconds', () => {
    expect(RECORD_TOTAL_MS).toBeLessThan(30000);
  });
});
