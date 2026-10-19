// Reads the triangle data of a GLB so the in-browser evaluator can check watertightness and degenerate
// faces the way the Python engine does (Trimesh, no vertex merging): per primitive, a mesh is closed when
// every edge is shared by exactly two faces, and a face is degenerate when its area is at most 1e-12 m2.
//
// Fail-closed: anything it cannot decode (compressed geometry, quantised or sparse accessors, strips and
// fans, truncated files) returns `readable: false` and the caller must not approve the asset.

const DEGENERATE_AREA_M2 = 1e-12;
const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;
const UNREADABLE_EXTENSIONS = ['KHR_draco_mesh_compression', 'EXT_meshopt_compression', 'KHR_mesh_quantization'];

export interface MeshAnalysis {
  readable: boolean;
  triangles: number;
  watertight: boolean;
  degenerateFaces: number;
}

interface Accessor {
  bufferView?: number;
  byteOffset?: number;
  componentType: number;
  count: number;
  type: string;
  sparse?: unknown;
  normalized?: boolean;
}
interface BufferView {
  byteOffset?: number;
  byteStride?: number;
}
interface Primitive {
  attributes?: { POSITION?: number };
  indices?: number;
  mode?: number;
}
interface Gltf {
  extensionsRequired?: string[];
  meshes?: { primitives?: Primitive[] }[];
  accessors?: Accessor[];
  bufferViews?: BufferView[];
}

const UNREADABLE: MeshAnalysis = { readable: false, triangles: 0, watertight: false, degenerateFaces: 0 };

function readChunks(buffer: ArrayBuffer): { gltf: Gltf; bin: DataView } | null {
  if (buffer.byteLength < 20) return null;
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== GLB_MAGIC) return null;
  const jsonLength = view.getUint32(12, true);
  if (view.getUint32(16, true) !== CHUNK_JSON || 20 + jsonLength > buffer.byteLength) return null;
  const gltf = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength))) as Gltf;
  const binHeader = 20 + jsonLength;
  if (binHeader + 8 > buffer.byteLength || view.getUint32(binHeader + 4, true) !== CHUNK_BIN) return null;
  const binLength = view.getUint32(binHeader, true);
  if (binHeader + 8 + binLength > buffer.byteLength) return null;
  return { gltf, bin: new DataView(buffer, binHeader + 8, binLength) };
}

function readIndices(gltf: Gltf, bin: DataView, index: number): Uint32Array | null {
  const accessor = gltf.accessors?.[index];
  if (!accessor || accessor.sparse || accessor.type !== 'SCALAR' || accessor.bufferView === undefined) return null;
  const bytes = { 5121: 1, 5123: 2, 5125: 4 }[accessor.componentType as 5121 | 5123 | 5125];
  if (!bytes) return null;
  const start = (gltf.bufferViews?.[accessor.bufferView]?.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  if (start + accessor.count * bytes > bin.byteLength) return null;
  const out = new Uint32Array(accessor.count);
  for (let i = 0; i < accessor.count; i += 1) {
    const at = start + i * bytes;
    out[i] = bytes === 1 ? bin.getUint8(at) : bytes === 2 ? bin.getUint16(at, true) : bin.getUint32(at, true);
  }
  return out;
}

function readPositions(gltf: Gltf, bin: DataView, index: number): Float32Array | null {
  const accessor = gltf.accessors?.[index];
  if (!accessor || accessor.sparse || accessor.normalized) return null;
  if (accessor.type !== 'VEC3' || accessor.componentType !== 5126 || accessor.bufferView === undefined) return null;
  const view = gltf.bufferViews?.[accessor.bufferView];
  const stride = view?.byteStride ?? 12;
  const start = (view?.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  if (start + (accessor.count - 1) * stride + 12 > bin.byteLength) return null;
  const out = new Float32Array(accessor.count * 3);
  for (let i = 0; i < accessor.count; i += 1) {
    for (let a = 0; a < 3; a += 1) out[i * 3 + a] = bin.getFloat32(start + i * stride + a * 4, true);
  }
  return out;
}

function analysePrimitive(gltf: Gltf, bin: DataView, primitive: Primitive): MeshAnalysis | null {
  if ((primitive.mode ?? 4) !== 4) return null;
  const positionIndex = primitive.attributes?.POSITION;
  if (positionIndex === undefined) return null;
  const positions = readPositions(gltf, bin, positionIndex);
  if (!positions) return null;
  const vertexCount = positions.length / 3;
  let indices: Uint32Array;
  if (primitive.indices === undefined) {
    indices = Uint32Array.from({ length: vertexCount - (vertexCount % 3) }, (_, i) => i);
  } else {
    const read = readIndices(gltf, bin, primitive.indices);
    if (!read) return null;
    indices = read;
  }
  const faces = Math.floor(indices.length / 3);
  const edges = new Map<number, number>();
  let degenerate = 0;
  for (let f = 0; f < faces; f += 1) {
    const [a, b, c] = [indices[f * 3], indices[f * 3 + 1], indices[f * 3 + 2]];
    if (a >= vertexCount || b >= vertexCount || c >= vertexCount) return null;
    for (const [p, q] of [[a, b], [b, c], [c, a]]) {
      const key = Math.min(p, q) * vertexCount + Math.max(p, q);
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
    const ux = positions[b * 3] - positions[a * 3];
    const uy = positions[b * 3 + 1] - positions[a * 3 + 1];
    const uz = positions[b * 3 + 2] - positions[a * 3 + 2];
    const vx = positions[c * 3] - positions[a * 3];
    const vy = positions[c * 3 + 1] - positions[a * 3 + 1];
    const vz = positions[c * 3 + 2] - positions[a * 3 + 2];
    const area = 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
    if (area <= DEGENERATE_AREA_M2) degenerate += 1;
  }
  let watertight = faces > 0;
  for (const count of edges.values()) {
    if (count !== 2) {
      watertight = false;
      break;
    }
  }
  return { readable: true, triangles: faces, watertight, degenerateFaces: degenerate };
}

export function analyzeGlbMesh(buffer: ArrayBuffer): MeshAnalysis {
  try {
    const chunks = readChunks(buffer);
    if (!chunks) return UNREADABLE;
    const { gltf, bin } = chunks;
    if (gltf.extensionsRequired?.some((e) => UNREADABLE_EXTENSIONS.includes(e))) return UNREADABLE;
    const primitives = (gltf.meshes ?? []).flatMap((m) => m.primitives ?? []);
    if (primitives.length === 0) return UNREADABLE;
    let triangles = 0;
    let degenerate = 0;
    let watertight = true;
    for (const primitive of primitives) {
      const result = analysePrimitive(gltf, bin, primitive);
      if (!result) return UNREADABLE;
      triangles += result.triangles;
      degenerate += result.degenerateFaces;
      watertight = watertight && result.watertight;
    }
    return { readable: true, triangles, watertight, degenerateFaces: degenerate };
  } catch {
    return UNREADABLE;
  }
}
