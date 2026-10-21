import { describe, expect, it } from 'vitest';
import { shouldRegisterWorker } from './register';

const base = { production: true, hasServiceWorker: true, secure: true, recording: false };

describe('shouldRegisterWorker', () => {
  it('registers in a secure production page', () => {
    expect(shouldRegisterWorker(base)).toBe(true);
  });

  it.each([
    ['development', { production: false }],
    ['no service worker support', { hasServiceWorker: false }],
    ['an insecure context', { secure: false }],
    ['a recording session', { recording: true }],
  ])('does not register for %s', (_name, change) => {
    expect(shouldRegisterWorker({ ...base, ...change })).toBe(false);
  });
});
