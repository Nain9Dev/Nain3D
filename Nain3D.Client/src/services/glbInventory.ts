// Texture sizes, material count and UV presence, read from the GLB JSON and image headers. Mirrors the Python
// engine (`src/nain3d/engine/inventory.py`) rule by rule; tests compare both on the bundled samples.
// Fail-closed: a texture whose size cannot be read is `null`, never a small number.

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;
const SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

export interface AssetInventory {
  readable: boolean;
  /** Largest side in pixels over all images; 0 when there are none, null when one could not be measured. */
  textureMaxSidePx: number | null;
  materialCount: number;
  texturedMaterialCount: number;
  hasUvCoordinates: boolean;
}

interface Material {
  pbrMetallicRoughness?: Record<string, unknown>;
  normalTexture?: unknown;
  occlusionTexture?: unknown;
  emissiveTexture?: unknown;
}
interface Gltf {
  images?: { bufferView?: number; uri?: string }[];
  bufferViews?: { byteOffset?: number; byteLength: number }[];
  materials?: Material[];
  meshes?: { primitives?: { attributes?: Record<string, number>; material?: number }[] }[];
}

const UNREADABLE: AssetInventory = {
  readable: false,
  textureMaxSidePx: null,
  materialCount: 0,
  texturedMaterialCount: 0,
  hasUvCoordinates: false,
};

export function readImageSize(data: Uint8Array): [number, number] | null {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const ascii = (at: number, n: number) => String.fromCharCode(...data.slice(at, at + n));
  try {
    if (data.length >= 24 && view.getUint32(0) === 0x89504e47 && ascii(12, 4) === 'IHDR') {
      return [view.getUint32(16), view.getUint32(20)];
    }
    if (data[0] === 0xff && data[1] === 0xd8) return jpegSize(data, view);
    if (data.length >= 30 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return webpSize(data, view, ascii);
  } catch {
    return null;
  }
  return null;
}

function jpegSize(data: Uint8Array, view: DataView): [number, number] | null {
  let i = 2;
  while (i + 4 <= data.length) {
    if (data[i] !== 0xff) return null;
    const marker = data[i + 1];
    if (SOF_MARKERS.has(marker)) return [view.getUint16(i + 7), view.getUint16(i + 5)];
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      i += 2;
      continue;
    }
    i += 2 + view.getUint16(i + 2);
  }
  return null;
}

function webpSize(data: Uint8Array, view: DataView, ascii: (at: number, n: number) => string): [number, number] | null {
  const kind = ascii(12, 4);
  if (kind === 'VP8X') {
    const le24 = (at: number) => data[at] | (data[at + 1] << 8) | (data[at + 2] << 16);
    return [le24(24) + 1, le24(27) + 1];
  }
  if (kind === 'VP8 ' && data[23] === 0x9d && data[24] === 0x01 && data[25] === 0x2a) {
    return [view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff];
  }
  if (kind === 'VP8L' && data[20] === 0x2f) {
    const bits = view.getUint32(21, true);
    return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
  }
  return null;
}

function readChunks(buffer: ArrayBuffer): { gltf: Gltf; bin: Uint8Array } | null {
  if (buffer.byteLength < 20) return null;
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== GLB_MAGIC) return null;
  let gltf: Gltf | null = null;
  let bin = new Uint8Array(0);
  let offset = 12;
  while (offset + 8 <= buffer.byteLength) {
    const length = view.getUint32(offset, true);
    const kind = view.getUint32(offset + 4, true);
    if (offset + 8 + length > buffer.byteLength) return null;
    const body = new Uint8Array(buffer, offset + 8, length);
    if (kind === CHUNK_JSON) gltf = JSON.parse(new TextDecoder().decode(body)) as Gltf;
    else if (kind === CHUNK_BIN) bin = body;
    offset += 8 + length;
  }
  return gltf ? { gltf, bin } : null;
}

function imageSize(gltf: Gltf, bin: Uint8Array, image: { bufferView?: number; uri?: string }): [number, number] | null {
  if (image.bufferView !== undefined) {
    const view = gltf.bufferViews?.[image.bufferView];
    if (!view) return null;
    const start = view.byteOffset ?? 0;
    return readImageSize(bin.slice(start, start + view.byteLength));
  }
  const uri = image.uri ?? '';
  const marker = ';base64,';
  if (uri.startsWith('data:') && uri.includes(marker)) {
    const raw = atob(uri.slice(uri.indexOf(marker) + marker.length));
    return readImageSize(Uint8Array.from(raw, (c) => c.charCodeAt(0)));
  }
  return null; // External files are not part of the hashed bytes and cannot be measured.
}

export function readInventory(buffer: ArrayBuffer): AssetInventory {
  try {
    const chunks = readChunks(buffer);
    if (!chunks) return UNREADABLE;
    const { gltf, bin } = chunks;

    const sizes = (gltf.images ?? []).map((image) => imageSize(gltf, bin, image));
    const textureMaxSidePx = sizes.some((s) => s === null)
      ? null
      : sizes.reduce((max, s) => Math.max(max, ...(s as [number, number])), 0);

    const primitives = (gltf.meshes ?? []).flatMap((m) => m.primitives ?? []);
    const referenced = new Set(primitives.filter((p) => p.material !== undefined).map((p) => p.material as number));
    const materials = gltf.materials ?? [];
    const textured = (index: number) => {
      const m = materials[index];
      if (!m) throw new Error('missing material');
      const pbr = m.pbrMetallicRoughness ?? {};
      return 'baseColorTexture' in pbr || 'metallicRoughnessTexture' in pbr || !!m.normalTexture || !!m.occlusionTexture || !!m.emissiveTexture;
    };

    return {
      readable: true,
      textureMaxSidePx,
      materialCount: referenced.size,
      texturedMaterialCount: [...referenced].filter(textured).length,
      hasUvCoordinates: primitives.length > 0 && primitives.every((p) => p.attributes?.TEXCOORD_0 !== undefined),
    };
  } catch {
    return UNREADABLE;
  }
}
