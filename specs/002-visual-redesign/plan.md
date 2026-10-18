# Plan 002 — Visual Redesign and Recording Mode

## 1. Layering (client)

```text
App.vue            state, URL mode, presentation clock; no business figures
components/        presentation only: render, capture input, format
composables/       clock and reduced-motion (no business logic)
i18n/              es.ts (source) + en.ts (typed against es) + t()
state/urlState.ts  ?mode ?lang ?sample ?clock ?format parsing
timeline.ts        pure reveal and recording schedules
viewModel.ts       check rows from the API payload (formatting only)
scene/overlay.ts   pure description of the scale overlay from the payload
scene/stage.ts     three.js stage, loaded on demand
services/          api.ts, mockEvaluator.ts (existing; contracts unchanged)
tools/             sample generator (build-time, not shipped)
```

Presentation reaches data only through `services/api.ts`, as before.

## 2. Technical approach (as built)

1. **Renderer** (ADR-002): `<model-viewer>` replaced by a lazily loaded three.js stage (Neutral tone mapping,
   procedural RoomEnvironment, one shadow-casting key light, brand-blue rim light). Overlays are 3D bars and
   boxes plus DOM labels projected from anchors.
2. **Samples** (ADR-003): `tools/generate-samples.mjs` with a small geometry library and a hand-written GLB/PNG
   writer (no new dependency). Welded, closed, outward-wound parts; the generator asserts this.
3. **i18n** (ADR-004): in-house typed catalogue; language order `?lang=`, `localStorage`, `es`.
4. **Reveal and recording**: `revealStateAt(ms)` and `recordStateAt(ms)` are pure; `useClock` is `auto` or
   `manual` (`?clock=manual`, `window.__nain.advance(ms)`). Recording camera is a function of time.
5. **Brand** (ADR-006): vendored tokens, self-hosted Urbanist and IBM Plex Mono.
6. **Quality tooling** (ADR-005): Vitest for pure modules, Playwright (+ axe) for captures and accessibility,
   ESLint with accessibility rules.

## 3. Phases (all done)

1. Gate repair and baseline. 2. i18n, brand, tooling. 3. Samples. 4. Scene and overlays. 5. Reveal and compare.
6. Recording mode. 7. Accessibility, performance, captures, docs.

## 4. Risks

- Renderer swap: mitigated by keeping model loading and overlays behind `StageView`.
- Hosting: `3d.naindev.com` deploys on push to `master`; nothing is pushed without owner authorisation.
- Software WebGL in tests exaggerates GPU timings (documented in the metrics).

## 5. Open questions for the owner

1. Approve ADR-002 to ADR-006 (T-022).
2. Defect demo (REQ-VR-05): see `spec.md` section 5, point 1.
3. Keep captures in git or move them to release assets (T-023).
