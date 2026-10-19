import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const html = readFileSync(fileURLToPath(new URL('../../index.html', import.meta.url)), 'utf8');
const policy = /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/.exec(html)?.[1] ?? '';
const directive = (name: string) => policy.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `)) ?? '';

describe('Content-Security-Policy (static hosting: delivered as a meta tag)', () => {
  it('is present', () => {
    expect(policy).not.toBe('');
  });

  it('denies everything not listed and blocks plugins, base rewrites and foreign form posts', () => {
    expect(directive('default-src')).toBe("default-src 'self'");
    expect(directive('object-src')).toBe("object-src 'none'");
    expect(directive('base-uri')).toBe("base-uri 'self'");
    expect(directive('form-action')).toBe("form-action 'self'");
  });

  it('only allows scripts from this site and the NainDev ecosystem bar, never inline or eval', () => {
    const scripts = directive('script-src');
    expect(scripts).toBe("script-src 'self' https://www.naindev.com");
    expect(scripts).not.toMatch(/unsafe-inline|unsafe-eval|\*/);
  });

  it('allows the blob and data sources the 3D stage needs and nothing external for images or fonts', () => {
    expect(directive('img-src')).toContain('blob:');
    expect(directive('img-src')).not.toMatch(/https?:\/\/|\*/);
    expect(directive('font-src')).toBe("font-src 'self'");
    expect(directive('connect-src')).toContain('blob:');
  });

  it('sends a strict referrer policy', () => {
    expect(html).toContain('<meta name="referrer" content="strict-origin-when-cross-origin" />');
  });
});
