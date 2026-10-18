# ADR-005: Vitest, Playwright and ESLint for the client

- Status: Approved
- Date: 2026-10-18
- Deciders: Aitor Nain Mendoza Vallejo (`NainDev`)

## Context

The client had no tests and no lint script. The brief requires test-first work, visual captures,
accessibility checks and LCP measurement.

## Decision

Add devDependencies only (nothing is shipped): `vitest`, `@types/node`, `@playwright/test`,
`@axe-core/playwright`, `eslint`, `typescript-eslint`, `eslint-plugin-vue`,
`eslint-plugin-vuejs-accessibility`, `vue-eslint-parser`, `globals`. Scripts: `test`, `lint`,
`test:e2e`, `measure`. Licences: MIT, Apache-2.0 or MPL-2.0 (axe-core).

Unit tests target pure modules (catalogue, URL state, timeline, overlay, view model) in the node
environment; component behaviour is covered by Playwright. No DOM emulation library is added.

## Consequences

- Install time and lockfile grow; the production bundle is unaffected.
- Playwright browsers are downloaded on demand (`npx playwright install chromium`).
- The captures run with software WebGL (`--use-angle=swiftshader`), so they work without a GPU.
