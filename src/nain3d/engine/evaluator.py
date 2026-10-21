from typing import List, Tuple
from ..domain.models import (
    CheckResult,
    CheckSeverity,
    ConformanceVerdict,
    GeometricFeatures,
    ProfileDefinition,
)


_MIB = 1024 * 1024


def _store_checks(features: GeometricFeatures, profile: ProfileDefinition, asset_size_bytes: int) -> List[CheckResult]:
    """Optional checks, added only when the profile defines the limit. All are blocking."""
    out: List[CheckResult] = []

    if profile.max_file_mb is not None:
        passed = asset_size_bytes <= profile.max_file_mb * _MIB
        out.append(
            CheckResult(
                name="file_size",
                label="File Weight (MB)",
                value=f"{asset_size_bytes / _MIB:.2f} MB",
                limit=f"<= {profile.max_file_mb:g} MB",
                passed=passed,
                severity=CheckSeverity.BLOCKING,
                message=(
                    f"File weight within limit ({asset_size_bytes / _MIB:.2f} MB)"
                    if passed
                    else f"File too heavy: {asset_size_bytes / _MIB:.2f} MB > {profile.max_file_mb:g} MB"
                ),
            )
        )

    if profile.max_texture_px is not None:
        measurable = features.inventory_readable and features.texture_max_side_px is not None
        side = features.texture_max_side_px or 0
        passed = measurable and side <= profile.max_texture_px  # Fail-closed when a texture cannot be measured.
        out.append(
            CheckResult(
                name="texture_resolution",
                label="Texture Resolution (px)",
                value=f"{side} px" if measurable else "unknown",
                limit=f"<= {profile.max_texture_px} px",
                passed=passed,
                severity=CheckSeverity.BLOCKING,
                message=(
                    f"Largest texture {side} px"
                    if passed
                    else "A texture could not be measured (external or unsupported image)"
                    if not measurable
                    else f"Texture too large: {side} px > {profile.max_texture_px} px"
                ),
            )
        )

    if profile.max_materials is not None:
        passed = features.material_count <= profile.max_materials
        out.append(
            CheckResult(
                name="material_budget",
                label="Material Budget",
                value=features.material_count,
                limit=profile.max_materials,
                passed=passed,
                severity=CheckSeverity.BLOCKING,
                message=(
                    f"{features.material_count} materials in use"
                    if passed
                    else f"Too many materials: {features.material_count} > {profile.max_materials}"
                ),
            )
        )

    if profile.require_uv_and_textures:
        passed = features.inventory_readable and features.has_uv_coordinates and features.textured_material_count >= 1
        out.append(
            CheckResult(
                name="uv_and_textures",
                label="UV Coordinates and Textures",
                value="present" if passed else "missing",
                limit="Required",
                passed=passed,
                severity=CheckSeverity.BLOCKING,
                message=(
                    "UV coordinates and textured materials present"
                    if passed
                    else "Meshes without UV coordinates or no textured material: the model will look flat"
                ),
            )
        )
    return out


def evaluate_conformance(
    features: GeometricFeatures,
    profile: ProfileDefinition,
    asset_size_bytes: int = 0,
) -> Tuple[List[CheckResult], ConformanceVerdict, str]:
    """
    Evaluates geometric features against the given profile definition using fail-closed logic.
    """
    checks: List[CheckResult] = []

    # 1. Triangle Count Budget
    pass_triangles = features.triangle_count <= profile.max_triangles
    checks.append(
        CheckResult(
            name="budget_triangles",
            label="Triangle Budget (Polygon Density)",
            value=features.triangle_count,
            limit=profile.max_triangles,
            passed=pass_triangles,
            severity=CheckSeverity.BLOCKING,
            message=(
                f"Within budget ({features.triangle_count:,} <= {profile.max_triangles:,})"
                if pass_triangles
                else f"Exceeds polygon limit: {features.triangle_count:,} > {profile.max_triangles:,}"
            ),
        )
    )

    # 2. Metric Scale Dimension
    pass_scale = features.max_dimension_m <= profile.max_dimension_m
    checks.append(
        CheckResult(
            name="metric_scale",
            label="Physical Extents (Metric Scale Bounds)",
            value=f"{features.max_dimension_m:.3f} m",
            limit=f"<= {profile.max_dimension_m:.1f} m",
            passed=pass_scale,
            severity=CheckSeverity.BLOCKING,
            message=(
                f"Scale conforms ({features.max_dimension_m:.3f} m <= {profile.max_dimension_m:.1f} m)"
                if pass_scale
                else f"Scale out of bounds: {features.max_dimension_m:.3f} m > {profile.max_dimension_m:.1f} m"
            ),
        )
    )

    # 3. Watertight Solid Integrity
    if profile.is_watertight_required:
        pass_watertight = features.is_watertight
        severity = CheckSeverity.BLOCKING
        msg = "Solid manifold verified" if pass_watertight else "Mesh is non-manifold or contains open boundary edges"
    else:
        pass_watertight = True
        severity = CheckSeverity.ADVISORY
        msg = "Watertightness not mandated for this category"

    checks.append(
        CheckResult(
            name="integrity_watertight",
            label="Solid Integrity (Watertightness)",
            value="Watertight Solid" if features.is_watertight else "Open Surface",
            limit="Required" if profile.is_watertight_required else "Optional",
            passed=pass_watertight,
            severity=severity,
            message=msg,
        )
    )

    # 4. Degenerate Faces Check
    pass_degenerate = features.degenerate_faces_count <= profile.max_degenerate_faces
    checks.append(
        CheckResult(
            name="degenerate_faces",
            label="Geometry Quality (Degenerate Faces)",
            value=features.degenerate_faces_count,
            limit=profile.max_degenerate_faces,
            passed=pass_degenerate,
            severity=CheckSeverity.BLOCKING,
            message=(
                "Zero degenerate micro-faces detected"
                if pass_degenerate
                else f"Detected {features.degenerate_faces_count} degenerate faces with area <= 1e-12 m²"
            ),
        )
    )

    checks.extend(_store_checks(features, profile, asset_size_bytes))

    # Fail-closed aggregation
    has_blocking_failure = any(not c.passed and c.severity == CheckSeverity.BLOCKING for c in checks)
    has_advisory_failure = any(not c.passed and c.severity == CheckSeverity.ADVISORY for c in checks)

    if has_blocking_failure:
        verdict = ConformanceVerdict.NON_CONFORMANT
        summary = "Asset REJECTED: One or more blocking technical contract rules failed."
    elif has_advisory_failure:
        verdict = ConformanceVerdict.CONFORMANT_WITH_FINDINGS
        summary = "Asset CONFORMANT WITH FINDINGS: All blocking criteria met; advisory warnings flagged."
    else:
        verdict = ConformanceVerdict.CONFORMANT
        summary = "Asset CONFORMANT: All technical contract criteria fully satisfied."

    return checks, verdict, summary
