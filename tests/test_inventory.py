"""Asset inventory (textures, materials, UVs) read straight from the GLB JSON and image headers."""
import base64
import json
import struct
from pathlib import Path

import pytest

from src.nain3d.engine.inventory import read_image_size, read_inventory

SAMPLES = Path(__file__).resolve().parents[1] / "Nain3D.Client" / "public" / "samples"


def png(width: int, height: int) -> bytes:
    return b"\x89PNG\r\n\x1a\n" + struct.pack(">I", 13) + b"IHDR" + struct.pack(">II", width, height) + b"\x08\x06\x00\x00\x00"


def jpeg(width: int, height: int) -> bytes:
    sof = b"\xff\xc0" + struct.pack(">HBHHB", 17, 8, height, width, 3) + b"\x01\x11\x00\x02\x11\x00\x03\x11\x00"
    return b"\xff\xd8" + b"\xff\xe0" + struct.pack(">H", 16) + b"JFIF\x00" + b"\x01\x01\x00\x00\x01\x00\x01\x00\x00" + sof


def webp_vp8x(width: int, height: int) -> bytes:
    payload = b"VP8X" + struct.pack("<I", 10) + b"\x00\x00\x00\x00" + (width - 1).to_bytes(3, "little") + (height - 1).to_bytes(3, "little")
    return b"RIFF" + struct.pack("<I", 4 + len(payload)) + b"WEBP" + payload


def glb(gltf: dict, binary: bytes = b"") -> bytes:
    body = json.dumps(gltf).encode()
    body += b" " * (-len(body) % 4)
    binary += b"\x00" * (-len(binary) % 4)
    chunks = struct.pack("<II", len(body), 0x4E4F534A) + body
    if binary:
        chunks += struct.pack("<II", len(binary), 0x004E4942) + binary
    return struct.pack("<III", 0x46546C67, 2, 12 + len(chunks)) + chunks


@pytest.mark.parametrize(
    "data,expected",
    [(png(1024, 512), (1024, 512)), (jpeg(2048, 1024), (2048, 1024)), (webp_vp8x(4096, 2048), (4096, 2048))],
)
def test_image_sizes_come_from_the_headers(data: bytes, expected: tuple[int, int]) -> None:
    assert read_image_size(data) == expected


def test_unknown_or_truncated_image_data_has_no_size() -> None:
    assert read_image_size(b"not an image") is None
    assert read_image_size(png(10, 10)[:12]) is None


def test_embedded_and_data_uri_textures_are_measured() -> None:
    image = png(2048, 1024)
    gltf = {
        "asset": {"version": "2.0"},
        "images": [
            {"bufferView": 0, "mimeType": "image/png"},
            {"uri": "data:image/png;base64," + base64.b64encode(png(512, 512)).decode()},
        ],
        "bufferViews": [{"buffer": 0, "byteOffset": 0, "byteLength": len(image)}],
        "buffers": [{"byteLength": len(image)}],
        "materials": [{"pbrMetallicRoughness": {"baseColorTexture": {"index": 0}}}],
        "meshes": [{"primitives": [{"attributes": {"POSITION": 0, "TEXCOORD_0": 1}, "material": 0}]}],
    }
    inv = read_inventory(glb(gltf, image))
    assert inv.readable and inv.texture_max_side_px == 2048
    assert inv.material_count == 1 and inv.textured_material_count == 1 and inv.has_uv_coordinates


def test_external_images_cannot_be_measured_and_fail_closed() -> None:
    gltf = {"asset": {"version": "2.0"}, "images": [{"uri": "textures/albedo.png"}], "meshes": []}
    inv = read_inventory(glb(gltf))
    assert inv.readable is True and inv.texture_max_side_px is None


def test_only_referenced_materials_count() -> None:
    gltf = {
        "asset": {"version": "2.0"},
        "materials": [{}, {}, {}],
        "meshes": [{"primitives": [{"attributes": {"POSITION": 0}, "material": 0}, {"attributes": {"POSITION": 0}, "material": 2}]}],
    }
    inv = read_inventory(glb(gltf))
    assert inv.material_count == 2 and inv.has_uv_coordinates is False and inv.textured_material_count == 0


def test_garbage_is_unreadable() -> None:
    assert read_inventory(b"not a glb").readable is False


@pytest.mark.parametrize(
    "sample,texture_px,materials,textured,uvs",
    [
        ("sample-shoe", 1024, 1, 1, True),
        ("sample-oversized-shoe", 1024, 1, 1, True),
        ("sample-monitor", 512, 3, 1, True),
        ("sample-chair", 0, 2, 0, True),
    ],
)
def test_bundled_samples(sample: str, texture_px: int, materials: int, textured: int, uvs: bool) -> None:
    inv = read_inventory((SAMPLES / f"{sample}.glb").read_bytes())
    assert inv.readable
    assert (inv.texture_max_side_px, inv.material_count, inv.textured_material_count, inv.has_uv_coordinates) == (
        texture_px,
        materials,
        textured,
        uvs,
    )
