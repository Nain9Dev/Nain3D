# ADR-003: Generate hero sample models by code, with no new dependency

- Status: Approved
- Date: 2026-10-18
- Deciders: Aitor Nain Mendoza Vallejo (`NainDev`)

## Context

The bundled samples were flat boxes. Richer models must cost nothing, carry no third-party licence
risk and be reproducible.

## Decision

Author the four samples (monitor, chair, industrial valve, oversized chair) procedurally with
`Nain3D.Client/tools/generate-samples.mjs` (`npm run generate:samples`). It uses only Node built-ins: a
small geometry library (`tools/lib/geometry.mjs`) and a hand-written deterministic GLB/PNG writer
(`tools/lib/glb.mjs`). No external CC0 asset is used, so there is no licence to record. No
`@gltf-transform/core` is added.

Constraints that shaped the models (verified by `tests/test_hero_samples.py` and the generator itself):

- Geometry is baked in world space: the in-browser evaluator reads POSITION accessor bounds and
  ignores node transforms.
- Parts are welded: the Python engine loads GLBs with `process=False` (no vertex merging), so a
  closed solid is "watertight" only if the file already shares its vertices.
- Non-industrial samples stay under 1,000 triangles because the in-browser heuristic proposes
  `Pieza Industrial` for any watertight mesh above that size (`mockEvaluator.ts`, unchanged).
- The generator asserts every part is a closed, outward-wound solid with no degenerate faces.

## Consequences

- Models are geometric, not photoreal; PBR materials, environment and shadows carry the look.
- The API serves the generated files when present (same bytes as the static site), falling back to the
  previous Trimesh primitives otherwise. Business rules and schemas are untouched.
