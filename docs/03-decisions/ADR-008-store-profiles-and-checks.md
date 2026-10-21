# ADR-008: Optional store checks and user-defined profiles

- Status: Proposed
- Date: 2026-10-21
- Deciders: owner (approval pending); feature requested in chat on 2026-10-21

## Context

The contract had four fixed checks and four fixed profiles. A store has its own limits and cares about
things the contract did not measure: how heavy the file is, how large the textures are, how many materials
it uses and whether it has UVs and textures.

## Decision

1. **Additive contract.** `ProfileDefinition` gets optional `max_file_mb`, `max_texture_px`, `max_materials` and
   `require_uv_and_textures`; `GeometricFeatures` gets an inventory (`texture_max_side_px`, `material_count`,
   `textured_material_count`, `has_uv_coordinates`, `inventory_readable`). Old payloads stay valid.
2. **Checks only when asked.** The matching check is added after the original four, always blocking. A profile that
   defines no store limit produces exactly the original four checks, so the built-in profiles and
   `docs/02-business-rules.md` are unchanged.
3. **Fail-closed.** A texture that cannot be measured fails the texture check; an unreadable file fails the UV check.
4. **Same truth in both engines.** The inventory is read from the GLB JSON and the PNG, JPEG and WebP headers, with no
   image library, in Python (`engine/inventory.py`) and TypeScript (`services/glbInventory.ts`). Tests compare them
   on the bundled samples.
5. **Bounds in one place per engine, mirrored.** The Pydantic model and `validateProfile` share the same limits; an
   out-of-range profile is refused (API 422, client error), never evaluated.
6. **User profiles live on the device** (`localStorage`); the API accepts one as `custom_profile` JSON in local
   development only.

## Consequences

- The business rules gain an optional section; the four original checks and profiles do not change.
- A profile editor and a PDF report depend on this contract (specs 006, PR 2 and 3).
- External textures cannot be measured (not part of the hashed bytes), so a profile with a texture limit rejects
  GLBs that reference external images. Embedded textures are the norm for `.glb`.
