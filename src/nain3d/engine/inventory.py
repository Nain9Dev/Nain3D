"""Reads what a store cares about besides the mesh: texture sizes, material count and UV coordinates.

Everything comes from the GLB JSON chunk and the image headers (PNG, JPEG, WebP); no image decoder is needed.
Fail-closed: a texture whose size cannot be read is reported as ``None``, never as a small number.
"""
import base64
import json
import struct
from dataclasses import dataclass
from typing import Optional, Tuple

_GLB_MAGIC = 0x46546C67
_CHUNK_JSON = 0x4E4F534A
_CHUNK_BIN = 0x004E4942
_SOF_MARKERS = {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}
_TEXTURE_SLOTS = ("baseColorTexture", "metallicRoughnessTexture")


@dataclass(frozen=True)
class AssetInventory:
    readable: bool
    #: Largest side in pixels over all images; 0 when there are none, None when one could not be measured.
    texture_max_side_px: Optional[int] = 0
    #: Distinct materials referenced by at least one primitive.
    material_count: int = 0
    textured_material_count: int = 0
    #: True when every primitive has TEXCOORD_0 (and there is at least one primitive).
    has_uv_coordinates: bool = False


def read_image_size(data: bytes) -> Optional[Tuple[int, int]]:
    """Width and height from a PNG, JPEG or WebP header, or None if unknown or truncated."""
    try:
        if data[:8] == b"\x89PNG\r\n\x1a\n" and data[12:16] == b"IHDR":
            return struct.unpack(">II", data[16:24])
        if data[:2] == b"\xff\xd8":
            return _jpeg_size(data)
        if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
            return _webp_size(data)
    except struct.error:
        return None
    return None


def _jpeg_size(data: bytes) -> Optional[Tuple[int, int]]:
    i = 2
    while i + 4 <= len(data):
        if data[i] != 0xFF:
            return None
        marker = data[i + 1]
        if marker in _SOF_MARKERS:
            height, width = struct.unpack(">HH", data[i + 5 : i + 9])
            return width, height
        if marker == 0xD8 or 0xD0 <= marker <= 0xD7 or marker == 0x01:
            i += 2
            continue
        i += 2 + struct.unpack(">H", data[i + 2 : i + 4])[0]
    return None


def _webp_size(data: bytes) -> Optional[Tuple[int, int]]:
    kind = data[12:16]
    if kind == b"VP8X":
        return int.from_bytes(data[24:27], "little") + 1, int.from_bytes(data[27:30], "little") + 1
    if kind == b"VP8 " and data[23:26] == b"\x9d\x01\x2a":
        return struct.unpack("<H", data[26:28])[0] & 0x3FFF, struct.unpack("<H", data[28:30])[0] & 0x3FFF
    if kind == b"VP8L" and data[20] == 0x2F:
        bits = int.from_bytes(data[21:25], "little")
        return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
    return None


def _chunks(glb: bytes):
    if len(glb) < 20 or struct.unpack("<I", glb[:4])[0] != _GLB_MAGIC:
        return None
    gltf = None
    binary = b""
    offset = 12
    while offset + 8 <= len(glb):
        length, kind = struct.unpack("<II", glb[offset : offset + 8])
        body = glb[offset + 8 : offset + 8 + length]
        if len(body) < length:
            return None
        if kind == _CHUNK_JSON:
            gltf = json.loads(body.decode("utf-8"))
        elif kind == _CHUNK_BIN:
            binary = body
        offset += 8 + length
    return (gltf, binary) if gltf is not None else None


def _image_size(gltf: dict, binary: bytes, image: dict) -> Optional[Tuple[int, int]]:
    if "bufferView" in image:
        view = gltf.get("bufferViews", [])[image["bufferView"]]
        start = view.get("byteOffset", 0)
        return read_image_size(binary[start : start + view["byteLength"]])
    uri = image.get("uri", "")
    if uri.startswith("data:") and ";base64," in uri:
        return read_image_size(base64.b64decode(uri.split(";base64,", 1)[1]))
    return None  # External files are not part of the hashed bytes and cannot be measured.


def read_inventory(glb: bytes) -> AssetInventory:
    try:
        parsed = _chunks(glb)
        if parsed is None:
            return AssetInventory(readable=False, texture_max_side_px=None)
        gltf, binary = parsed

        sizes = [_image_size(gltf, binary, image) for image in gltf.get("images", [])]
        if any(size is None for size in sizes):
            texture_max: Optional[int] = None
        else:
            texture_max = max((max(size) for size in sizes if size), default=0)

        primitives = [p for mesh in gltf.get("meshes", []) for p in mesh.get("primitives", [])]
        referenced = {p["material"] for p in primitives if "material" in p}
        materials = gltf.get("materials", [])

        def textured(index: int) -> bool:
            material = materials[index]
            pbr = material.get("pbrMetallicRoughness", {})
            return any(slot in pbr for slot in _TEXTURE_SLOTS) or any(
                slot in material for slot in ("normalTexture", "occlusionTexture", "emissiveTexture")
            )

        return AssetInventory(
            readable=True,
            texture_max_side_px=texture_max,
            material_count=len(referenced),
            textured_material_count=sum(1 for index in referenced if textured(index)),
            has_uv_coordinates=bool(primitives) and all("TEXCOORD_0" in p.get("attributes", {}) for p in primitives),
        )
    except (ValueError, KeyError, IndexError, TypeError, struct.error):
        return AssetInventory(readable=False, texture_max_side_px=None)
