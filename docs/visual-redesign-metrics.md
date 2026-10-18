# Visual redesign metrics

Method: `node scripts/measure.mjs <url> <outDir> [nonConformantRegex] [direct]` (Playwright Chromium
headless, 1920x1080, software WebGL for both runs, three cold contexts, median reported). Static builds
served by `vite preview`; no backend running, so the in-browser evaluator is used (same as 3d.naindev.com).
Same-origin text assets are gzip-compressed for the byte count (`vite preview` serves them raw);
cross-origin responses use their real transfer size. Raw results: `docs/assets/visual-redesign/before/metrics.json`
and `.../after/metrics.json`. Date: 2026-10-18.

| Metric | Before (master `1b26ca6` + build fix) | After (feat/visual-redesign) |
|:---|---:|---:|
| LCP, cold, runs (ms) | 1,128 / 1,120 / 944 (median 1,120) | 248 / 140 / 112 (median 140) |
| First 3D frame, cold (ms) | not measurable (`<model-viewer>`) | 6,541 (outlier, machine busy with the e2e run) / 423 / 388; an earlier run gave 545 / 443 / 385 |
| Transferred per cold load (gzip), median | 424 kB | 452 kB (+6.6 %) |
| App JS (gzip) | 35.6 kB | 38.5 kB |
| Lazy 3D chunk (gzip) | 0 (engine loaded from Google CDN) | 166 kB |
| CSS (gzip) | 4.2 kB | 4.7 kB |
| Third-party hosts at runtime | 6 (Google APIs, Google Fonts x2, brand.naindev.com, naindev.com) | 1 (naindev.com ecosystem bar) |
| Sample GLBs | 12 triangles each, 1 kB | 676 to 6,848 triangles, 26 to 215 kB |

Reading the numbers:

- LCP improves because the brand heading is the largest text and paints with the first frame, fonts are
  self-hosted, and no render-blocking third-party stylesheet or script remains. The 3D canvas is not an LCP
  candidate, so "first 3D frame" is reported separately.
- ADR-002 set a limit of +10 % transferred bytes; the redesign stays inside it.
- Software WebGL inflates GPU-bound timings on both sides; on real hardware the 3D frame arrives sooner.
- `vite build` reports no warnings (`chunkSizeWarningLimit` is raised to 900 kB for the lazy three.js chunk,
  653 kB minified).

Captures: before in `docs/assets/visual-redesign/before/`, after in `docs/assets/visual-redesign/after/`.
