// Fixed schedules, in milliseconds, for the verdict reveal and the recording sequence.
// Pure functions of time: the same time always yields the same state, which makes recordings and
// Playwright captures reproducible.
import type { SampleId } from './state/urlState';

export const REVEAL = {
  aiAt: 500,
  firstCheckAt: 1300,
  checkEvery: 650,
  verdictAfterLastCheck: 700,
  latencyAfterVerdict: 450,
  latencyDuration: 700,
} as const;

export interface RevealState {
  aiVisible: boolean;
  checksShown: number;
  verdictVisible: boolean;
  /** 0..1 progress of the latency counter. */
  latencyProgress: number;
  done: boolean;
}

function verdictAt(checkCount: number): number {
  return REVEAL.firstCheckAt + (checkCount - 1) * REVEAL.checkEvery + REVEAL.verdictAfterLastCheck;
}

export function revealDuration(checkCount: number): number {
  return verdictAt(checkCount) + REVEAL.latencyAfterVerdict + REVEAL.latencyDuration;
}

export function revealStateAt(ms: number, checkCount: number, reducedMotion: boolean): RevealState {
  if (reducedMotion) {
    return { aiVisible: true, checksShown: checkCount, verdictVisible: true, latencyProgress: 1, done: true };
  }
  const checksShown =
    ms < REVEAL.firstCheckAt ? 0 : Math.min(checkCount, 1 + Math.floor((ms - REVEAL.firstCheckAt) / REVEAL.checkEvery));
  const verdictVisible = ms >= verdictAt(checkCount);
  const latencyStart = verdictAt(checkCount) + REVEAL.latencyAfterVerdict;
  const latencyProgress = verdictVisible
    ? Math.min(1, Math.max(0, (ms - latencyStart) / REVEAL.latencyDuration))
    : 0;
  return {
    aiVisible: ms >= REVEAL.aiAt,
    checksShown,
    verdictVisible,
    latencyProgress,
    done: ms >= revealDuration(checkCount),
  };
}

export interface RecordSegment {
  sampleId: SampleId;
  startMs: number;
}

/** Hook (0-2 s) is the conformant hero; the non-conformant sample lands the contrast. */
export const RECORD_SEQUENCE: readonly RecordSegment[] = [
  { sampleId: 'sample-industrial', startMs: 0 },
  { sampleId: 'sample-oversized-chair', startMs: 7000 },
];
export const RECORD_END_CARD_AT = 16500;
export const RECORD_TOTAL_MS = 20000;

export interface RecordState {
  index: number;
  localMs: number;
  endCard: boolean;
}

export function recordStateAt(ms: number): RecordState {
  if (ms >= RECORD_END_CARD_AT) {
    const last = RECORD_SEQUENCE.length - 1;
    return { index: last, localMs: ms - RECORD_SEQUENCE[last].startMs, endCard: true };
  }
  let index = 0;
  for (let i = 0; i < RECORD_SEQUENCE.length; i += 1) {
    if (ms >= RECORD_SEQUENCE[i].startMs) index = i;
  }
  return { index, localMs: ms - RECORD_SEQUENCE[index].startMs, endCard: false };
}
