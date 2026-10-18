"""The generated hero samples (Nain3D.Client/public/samples) must keep their documented verdicts."""
import hashlib
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from src.nain3d.main import app

client = TestClient(app)
SAMPLES_DIR = Path(__file__).resolve().parents[1] / "Nain3D.Client" / "public" / "samples"

EXPECTED = {
    "sample-monitor": "CONFORMANT",
    "sample-chair": "CONFORMANT",
    "sample-industrial": "CONFORMANT",
    "sample-oversized-chair": "NON_CONFORMANT",
    "sample-shoe": "CONFORMANT",  # CC BY 4.0 photoreal model, see Nain3D.Client/src/samples/catalog.ts
    "sample-oversized-shoe": "NON_CONFORMANT",
}


@pytest.mark.parametrize("sample_id,verdict", EXPECTED.items())
def test_hero_sample_verdict(sample_id: str, verdict: str) -> None:
    glb = (SAMPLES_DIR / f"{sample_id}.glb").read_bytes()
    res = client.post(
        "/api/v1/conformance/evaluate",
        files={"file": (f"{sample_id}.glb", glb, "model/gltf-binary")},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["verdict"] == verdict
    assert data["features"]["degenerate_faces_count"] == 0
    assert data["features"]["triangle_count"] > 500  # richer than the old 12-triangle boxes


def test_oversized_shoe_fails_only_on_scale() -> None:
    glb = (SAMPLES_DIR / "sample-oversized-shoe.glb").read_bytes()
    data = client.post(
        "/api/v1/conformance/evaluate",
        files={"file": ("sample-oversized-shoe.glb", glb, "model/gltf-binary")},
    ).json()
    failed = [c["name"] for c in data["checks"] if not c["passed"]]
    assert failed == ["metric_scale"]
    assert data["features"]["max_dimension_m"] == pytest.approx(5.0, abs=0.01)


def test_hero_samples_are_listed_by_the_api() -> None:
    listed = {s["id"] for s in client.get("/api/v1/conformance/samples").json()}
    assert set(EXPECTED) <= listed


def test_oversized_chair_fails_only_on_scale() -> None:
    glb = (SAMPLES_DIR / "sample-oversized-chair.glb").read_bytes()
    data = client.post(
        "/api/v1/conformance/evaluate",
        files={"file": ("sample-oversized-chair.glb", glb, "model/gltf-binary")},
        data={"override_profile": "Mobiliario (Chair)"},
    ).json()
    failed = [c["name"] for c in data["checks"] if not c["passed"]]
    assert failed == ["metric_scale"]
    assert data["features"]["max_dimension_m"] == pytest.approx(5.0, abs=0.01)


def test_industrial_valve_is_watertight() -> None:
    glb = (SAMPLES_DIR / "sample-industrial.glb").read_bytes()
    data = client.post(
        "/api/v1/conformance/evaluate",
        files={"file": ("sample-industrial.glb", glb, "model/gltf-binary")},
        data={"override_profile": "Pieza Industrial"},
    ).json()
    assert data["features"]["is_watertight"] is True
    assert data["verdict"] == "CONFORMANT"


@pytest.mark.parametrize("sample_id", EXPECTED)
def test_api_serves_the_generated_sample(sample_id: str) -> None:
    served = client.get(f"/api/v1/conformance/samples/{sample_id}/download").content
    on_disk = (SAMPLES_DIR / f"{sample_id}.glb").read_bytes()
    assert hashlib.sha256(served).hexdigest() == hashlib.sha256(on_disk).hexdigest()
