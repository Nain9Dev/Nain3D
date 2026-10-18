import { onBeforeUnmount, ref } from 'vue';
import type { ClockMode } from '../state/urlState';

/**
 * Shared presentation clock in milliseconds.
 * `auto` follows wall time; `manual` only moves through `advance`, which makes captures reproducible.
 */
export function useClock(mode: ClockMode) {
  const now = ref(0);
  let raf = 0;
  let origin = 0;
  let running = false;

  function start(): void {
    if (mode === 'manual' || running) return;
    running = true;
    origin = performance.now() - now.value;
    const tick = () => {
      now.value = performance.now() - origin;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  function advance(ms: number): void {
    now.value += ms;
  }

  function reset(): void {
    now.value = 0;
    origin = performance.now();
  }

  onBeforeUnmount(() => cancelAnimationFrame(raf));

  return { now, start, advance, reset, mode };
}

export type PresentationClock = ReturnType<typeof useClock>;
