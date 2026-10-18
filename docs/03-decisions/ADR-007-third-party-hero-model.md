# ADR-007: Third-party hero model with a reproducible optimisation pipeline

- Status: Proposed
- Date: 2026-10-18
- Deciders: owner (approval pending); use of third-party models authorised in chat on 2026-10-18

## Context

The procedural samples (ADR-003) are clean but geometric. A detailed, photoreal model makes the first
two seconds of the demo much stronger. Candidates in the owner's asset library were measured with the
Python engine and the in-browser evaluator:

| Model | Licence | Triangles | Result in the engine |
|:---|:---|---:|:---|
| MaterialsVariantsShoe (Shopify) | CC BY 4.0 | 22,700 | conformant, 0.30 m, 0 degenerate faces |
| BoomBox, Lantern, WaterBottle (Microsoft) | CC0 | 4,500 to 6,000 | conformant (Lantern is Draco-compressed) |
| AntiqueCamera (UX3D) | CC0 plus a UX3D trademark on one tripod leg | 20,000 | non-conformant (non-metric units, 8 degenerate faces) |
| Generic sedan, supercars | CC BY 4.0 | 113,000 to 3,000,000 | exceeds every triangle budget; Draco decoding unsupported by the engine |

## Decision

1. Use **Materials Variants Shoe** (Shopify, CC BY 4.0) as the hero pair: `sample-shoe` (conformant) and
   `sample-oversized-shoe` (the same model baked to 5.0 m, rejected on scale). Same model, wrong scale, is the
   clearest possible contrast.
2. Credit is one small line inside the 3D frame (`Model: <title> · <author> · <licence>`), so recordings carry it.
   Credits live in `src/samples/catalog.ts`; a test requires author, licence URL and source for every credited sample.
3. Source files stay outside the repository (`D:/3D-Assets`). `npm run optimize:models` reads
   `tools/model-sources.json`, verifies each source SHA-256, keeps one material variant, bakes transforms and scale
   into the vertices, resizes textures (colour 1024 px, data maps 512 px, JPEG) and prunes unused data (7.8 MB to 0.83 MB).
4. Geometry stays **uncompressed** (no Draco, no meshopt): the Python engine cannot decode them, so one file must
   give the same verdict in both engines.
5. Add devDependencies `@gltf-transform/core`, `@gltf-transform/extensions`, `@gltf-transform/functions` (MIT) and
   `sharp` (Apache-2.0). Nothing is shipped to the browser.
6. Adding a model later means: a data entry in `catalog.ts`, two catalogue keys, and an entry in
   `model-sources.json`. No component changes.

## Consequences

- Two third-party GLBs (0.83 MB each) are committed under `public/samples/`. The owner's asset README forbids
  heavy 3D files in repositories; this is a deliberate, small exception limited to licensed demo assets.
- Only CC0 and CC BY models are acceptable; the licence is verified at the source before a model is added.
- The in-browser evaluator is a heuristic: it reports the sneaker as a watertight `Pieza Industrial`, while the
  Python engine finds an open surface and proposes `Mobiliario (Chair)`. The verdict is the same (conformant,
  and non-conformant at 5 m), but the category and watertightness text differ between engines.
  Fixing that means changing the evaluator, which is out of scope for a presentation change.
