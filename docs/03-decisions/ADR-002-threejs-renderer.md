# ADR-002: Replace `<model-viewer>` with tree-shaken three.js

- Status: Approved
- Date: 2026-10-18
- Deciders: Aitor Nain Mendoza Vallejo (`NainDev`)

## Context

`<model-viewer>` is loaded from a CDN and offers no control over the scene graph. The redesign needs a
red bounding box, a limit box and a ruler drawn in 3D from `EvaluationResult` data, image-based
lighting, soft shadows, and a manual frame clock so recordings are reproducible. The CDN script
already bundles its own three.js, so the page already pays for it.

## Decision

Add `three` (MIT) as a runtime dependency, import only the used modules (`GLTFLoader`, `RoomEnvironment`,
controls) so Vite tree-shakes it, and keep the `AssetViewer` component contract. Environment lighting is
generated procedurally (no HDR download, zero cost).

## Consequences

- Removes a third-party CDN request and its render-blocking script.
- Bundle grows locally; total transferred size must not exceed the baseline by more than 10 %,
  measured in T-002/T-018. If it does, revisit.
- Rendering code is ours to maintain.

## Alternatives

- Keep `<model-viewer>` with hotspots: no 3D overlays, no deterministic clock.
- Babylon.js: larger, no advantage here.
