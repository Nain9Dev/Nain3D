# Business Rules & Conformance Profiles — Nain3D Gateway

## 1. Conformance Profiles

Every asset evaluation enforces a strict technical contract profile:

| Profile | Category | Max Triangles | Max Dimension | Watertight Required | Max Degenerate Faces |
|:---|:---|:---:|:---:|:---:|:---:|
| `monitor-std-01` | Monitor | 25,000 | 2.5 m | No | 0 |
| `furniture-chair-01` | Mobiliario (Chair) | 50,000 | 3.0 m | No | 0 |
| `industrial-part-01` | Pieza Industrial | 100,000 | 1.2 m | **Yes (Blocking)** | 0 |
| `prop-decor-01` | Prop / Decorativo | 35,000 | 4.0 m | No | 0 |

## 2. Checks Description

1. **Triangle Budget (`budget_triangles`):**
   Ensures the total face count does not exceed real-time rendering GPU budgets. Severity: **Blocking**.
2. **Metric Scale (`metric_scale`):**
   Ensures the maximum bounding dimension (max of extents $[X, Y, Z]$) does not exceed physical real-world boundaries. Severity: **Blocking**.
3. **Solid Integrity (`integrity_watertight`):**
   Verifies whether the mesh forms a closed manifold volume. Required for physics simulations, manufacturing, and 3D printing. Severity: **Blocking** when mandated by profile.
4. **Degenerate Faces (`degenerate_faces`):**
   Detects micro-triangles with area $\le 10^{-12}\text{ m}^2$, which cause numerical instability in shading and physics engines. Severity: **Blocking**.
5. **Optional store checks** (ADR-008). Added after the four above only when a profile defines the limit; the four
   built-in profiles define none, so they keep running exactly four checks. All are **Blocking**:
   - `file_size`: file weight in MB at most `max_file_mb`.
   - `texture_resolution`: largest texture side in pixels at most `max_texture_px`. A model without textures passes; a
     texture that cannot be measured (external or unsupported image) fails.
   - `material_budget`: distinct materials in use at most `max_materials`.
   - `uv_and_textures`: when `require_uv_and_textures` is set, every mesh primitive has UV coordinates and at least one
     used material has a texture.
