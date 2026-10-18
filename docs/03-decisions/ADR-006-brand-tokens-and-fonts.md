# ADR-006: Vendored NainDev tokens and self-hosted brand fonts

- Status: Approved
- Date: 2026-10-18
- Deciders: Aitor Nain Mendoza Vallejo (`NainDev`)

## Context

The client linked `brand.naindev.com/tokens.css` and Google Fonts (Inter, Outfit, JetBrains Mono): two
render-blocking third-party stylesheets and a visual identity that differs from the NainDev brandbook
(Urbanist, IBM Plex Mono, paper/blue/green/red tokens). Recording needs a stable look with no network
dependency at capture time.

## Decision

- Vendor `brandbook/tokens.css` (v1.5) as `src/styles/tokens.css`; the source stays the brandbook repository
  and the copy is refreshed by hand when the tokens change.
- Add `@fontsource-variable/urbanist` and `@fontsource/ibm-plex-mono` (both SIL OFL 1.1) as devDependencies
  that Vite bundles; only the Latin subsets the page uses are downloaded by the browser.
- Verdict colours follow the brand accents (`#80FF00`, `#FF001F`); text on them meets WCAG AA
  (black on green; white on `#C4001A` red ink), verified by axe in `e2e/quality.spec.ts`.

## Consequences

- Fonts add about 100 kB of cached assets; no third-party font request remains.
- Token drift between the brandbook and the client is possible until synchronised manually.
- Licence check: both fonts are OFL; the owner confirms before release (task T-005 is `[M]`).
