"""Optional store checks: file weight, texture resolution, material budget, UVs and textures."""
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from src.nain3d.domain.models import GeometricFeatures, ProfileDefinition
from src.nain3d.domain.profiles import PROFILES
from src.nain3d.engine.evaluator import evaluate_conformance
from src.nain3d.main import app

SAMPLES = Path(__file__).resolve().parents[1] / "Nain3D.Client" / "public" / "samples"
client = TestClient(app)

BASE = dict(
    id="store-1",
    name="My store",
    description="Custom",
    max_triangles=50000,
    max_dimension_m=3.0,
    is_watertight_required=False,
    max_degenerate_faces=0,
)


def features(**over) -> GeometricFeatures:
    data = dict(
        triangle_count=1000,
        vertex_count=800,
        is_watertight=False,
        extents=[1.0, 1.0, 1.0],
        max_dimension_m=1.0,
        volume_m3=0.0,
        degenerate_faces_count=0,
        texture_max_side_px=1024,
        material_count=2,
        textured_material_count=1,
        has_uv_coordinates=True,
        inventory_readable=True,
    )
    data.update(over)
    return GeometricFeatures(**data)


def names(checks) -> list[str]:
    return [c.name for c in checks]


def test_built_in_profiles_still_run_exactly_four_checks() -> None:
    for profile in PROFILES.values():
        checks, _, _ = evaluate_conformance(features(), profile, asset_size_bytes=10**9)
        assert len(checks) == 4


def test_store_checks_appear_only_when_the_profile_asks_for_them() -> None:
    profile = ProfileDefinition(**BASE, max_file_mb=5, max_texture_px=2048, max_materials=4, require_uv_and_textures=True)
    checks, verdict, _ = evaluate_conformance(features(), profile, asset_size_bytes=2 * 1024 * 1024)
    assert names(checks)[4:] == ["file_size", "texture_resolution", "material_budget", "uv_and_textures"]
    assert verdict.value == "CONFORMANT"


@pytest.mark.parametrize(
    "limit,over,failed",
    [
        ({"max_file_mb": 1}, {}, "file_size"),
        ({"max_texture_px": 512}, {}, "texture_resolution"),
        ({"max_materials": 1}, {}, "material_budget"),
        ({"require_uv_and_textures": True}, {"has_uv_coordinates": False}, "uv_and_textures"),
        ({"require_uv_and_textures": True}, {"textured_material_count": 0}, "uv_and_textures"),
    ],
)
def test_each_limit_rejects_the_asset(limit: dict, over: dict, failed: str) -> None:
    profile = ProfileDefinition(**BASE, **limit)
    checks, verdict, _ = evaluate_conformance(features(**over), profile, asset_size_bytes=2 * 1024 * 1024)
    assert [c.name for c in checks if not c.passed] == [failed]
    assert verdict.value == "NON_CONFORMANT"


def test_unmeasurable_textures_fail_closed() -> None:
    profile = ProfileDefinition(**BASE, max_texture_px=4096)
    checks, verdict, _ = evaluate_conformance(features(texture_max_side_px=None), profile)
    assert [c.name for c in checks if not c.passed] == ["texture_resolution"]
    assert verdict.value == "NON_CONFORMANT"


def test_no_textures_pass_a_resolution_limit() -> None:
    profile = ProfileDefinition(**BASE, max_texture_px=256)
    checks, verdict, _ = evaluate_conformance(features(texture_max_side_px=0), profile)
    assert verdict.value == "CONFORMANT" and checks[-1].passed


@pytest.mark.parametrize(
    "bad",
    [{"max_file_mb": 0}, {"max_file_mb": -1}, {"max_texture_px": 4}, {"max_materials": -1}, {"max_triangles": 0}],
)
def test_nonsense_limits_are_rejected(bad: dict) -> None:
    with pytest.raises(ValidationError):
        ProfileDefinition(**{**BASE, **bad})


def post(sample: str, profile: dict | None):
    data = {"custom_profile": json.dumps(profile)} if profile is not None else {}
    return client.post(
        "/api/v1/conformance/evaluate",
        files={"file": (f"{sample}.glb", (SAMPLES / f"{sample}.glb").read_bytes(), "model/gltf-binary")},
        data=data,
    )


def test_api_applies_a_custom_profile_with_store_checks() -> None:
    res = post("sample-shoe", {**BASE, "max_texture_px": 512, "max_file_mb": 5})
    assert res.status_code == 200
    body = res.json()
    assert body["applied_profile"]["id"] == "store-1"
    assert body["verdict"] == "NON_CONFORMANT"
    assert [c["name"] for c in body["checks"] if not c["passed"]] == ["texture_resolution"]
    assert body["features"]["texture_max_side_px"] == 1024


def test_api_rejects_an_invalid_custom_profile() -> None:
    assert post("sample-chair", {**BASE, "max_file_mb": -3}).status_code == 422
    res = client.post(
        "/api/v1/conformance/evaluate",
        files={"file": ("a.glb", (SAMPLES / "sample-chair.glb").read_bytes(), "model/gltf-binary")},
        data={"custom_profile": "{not json"},
    )
    assert res.status_code == 422


def test_built_in_evaluation_is_unchanged() -> None:
    body = post("sample-chair", None).json()
    assert len(body["checks"]) == 4 and body["verdict"] == "CONFORMANT"
