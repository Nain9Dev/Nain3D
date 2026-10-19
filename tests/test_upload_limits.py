"""Upload safeguards promised in SECURITY.md: bounded size, .glb only, binary header checked before parsing."""
from pathlib import Path

from fastapi.testclient import TestClient

from src.nain3d.api.routes import MAX_UPLOAD_BYTES
from src.nain3d.main import app

client = TestClient(app)
SAMPLES = Path(__file__).resolve().parents[1] / "Nain3D.Client" / "public" / "samples"


def post(name: str, content: bytes):
    return client.post(
        "/api/v1/conformance/evaluate",
        files={"file": (name, content, "model/gltf-binary")},
    )


def test_limit_is_fifty_megabytes() -> None:
    assert MAX_UPLOAD_BYTES == 50 * 1024 * 1024


def test_oversized_upload_is_refused_with_413() -> None:
    res = post("big.glb", b"glTF" + b"\x00" * MAX_UPLOAD_BYTES)
    assert res.status_code == 413


def test_upload_at_the_limit_is_not_refused_for_its_size() -> None:
    res = post("limit.glb", b"glTF" + b"\x00" * (MAX_UPLOAD_BYTES - 4))
    assert res.status_code != 413


def test_non_glb_extension_is_refused_with_415() -> None:
    assert post("model.obj", b"v 0 0 0").status_code == 415
    assert post("model.gltf", b"{}").status_code == 415


def test_file_without_the_glb_header_is_refused_before_parsing() -> None:
    res = post("fake.glb", b"this is not a binary glTF")
    assert res.status_code == 422
    assert "header" in res.json()["detail"].lower()


def test_valid_glb_is_still_evaluated() -> None:
    assert post("chair.glb", (SAMPLES / "sample-chair.glb").read_bytes()).status_code == 200


def test_unknown_sample_id_is_a_404_not_a_server_error() -> None:
    res = client.get("/api/v1/conformance/samples/does-not-exist/download")
    assert res.status_code == 404
    res = client.get("/api/v1/conformance/samples/..%2F..%2Fetc%2Fpasswd/download")
    assert res.status_code == 404
