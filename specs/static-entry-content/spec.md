# Static entry content for crawlers

Status: Proposed
Owner: naindev
Scope: `Nain3D.Client/index.html`, `scripts/index-seo.test.mjs`, `.github/workflows/index-seo.yml`

## Problem

The demo is a single-page app. The HTML that a crawler receives before any script
runs holds a title, a description and an empty mount point. Google renders
JavaScript, but several search engines and AI answer engines read only the raw HTML.

## Requirements

- **REQ-STATIC-001** — The entry page shall contain a `<noscript>` fallback with
  one `<h1>`, the same description as the meta tag and a link to the repository.
- **REQ-STATIC-002** — The visible interface shall not change: the fallback is
  rendered only when scripts are off.

## Out of scope

- Server-side rendering or prerendering the app.
