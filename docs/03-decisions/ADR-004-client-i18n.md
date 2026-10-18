# ADR-004: Typed in-house i18n catalogue, no library

- Status: Approved
- Date: 2026-10-18
- Deciders: Aitor Nain Mendoza Vallejo (`NainDev`)

## Context

The portfolio keeps Spanish as the authoritative source and an English catalogue with reviewed
segments (`src/i18n/en-US.json`, `runtime.json`), generated at build time. The client is a Vue SPA with
about 100 short strings.

## Decision

- `src/i18n/es.ts`: source object (`as const`). `src/i18n/en.ts`: `Record<keyof typeof es, string>`, so a
  missing key fails `vue-tsc`. A Vitest test fails on extra keys and on literal strings in templates.
- Language order: `?lang=`, then `localStorage` key `nain3d.lang`, then `es`. No cookies.
- Technical terms without an equivalent stay in English in both catalogues.
- No `vue-i18n`: the needs (flat keys, `{n}` interpolation) do not justify roughly 15 kB gzip.

## Consequences

- Plural rules and ICU are not supported; strings are written to avoid them.
- English text is a draft until the owner marks it reviewed in the catalogue header.
