// Builds tiny in-memory GLBs for unit tests (one mesh, one triangle-list primitive, float32 positions).
export interface FixtureOptions {
  positions: number[];
  indices?: number[];
  extensionsRequired?: string[];
  mode?: number;
}

function pad4(bytes: Uint8Array, fill: number): Uint8Array {
  const size = Math.ceil(bytes.length / 4) * 4;
  const out = new Uint8Array(size).fill(fill);
  out.set(bytes);
  return out;
}

export function buildGlb({ positions, indices, extensionsRequired, mode = 4 }: FixtureOptions): ArrayBuffer {
  const pos = new Float32Array(positions);
  const idx = indices ? new Uint16Array(indices) : null;
  const posBytes = new Uint8Array(pos.buffer);
  const idxBytes = idx ? new Uint8Array(idx.buffer) : new Uint8Array(0);
  const idxPadded = pad4(idxBytes, 0);
  const bin = new Uint8Array(posBytes.length + idxPadded.length);
  bin.set(posBytes, 0);
  bin.set(idxPadded, posBytes.length);

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let a = 0; a < 3; a += 1) {
      min[a] = Math.min(min[a], positions[i + a]);
      max[a] = Math.max(max[a], positions[i + a]);
    }
  }

  const json = {
    asset: { version: '2.0' },
    ...(extensionsRequired ? { extensionsUsed: extensionsRequired, extensionsRequired } : {}),
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, ...(idx ? { indices: 1 } : {}), mode }] }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: pos.length / 3, type: 'VEC3', min, max },
      ...(idx ? [{ bufferView: 1, componentType: 5123, count: idx.length, type: 'SCALAR' }] : []),
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: posBytes.length },
      ...(idx ? [{ buffer: 0, byteOffset: posBytes.length, byteLength: idxBytes.length }] : []),
    ],
    buffers: [{ byteLength: bin.length }],
  };
  const jsonBytes = pad4(new TextEncoder().encode(JSON.stringify(json)), 0x20);

  const total = 12 + 8 + jsonBytes.length + 8 + bin.length;
  const out = new ArrayBuffer(total);
  const view = new DataView(out);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonBytes.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(out, 20, jsonBytes.length).set(jsonBytes);
  const binHeader = 20 + jsonBytes.length;
  view.setUint32(binHeader, bin.length, true);
  view.setUint32(binHeader + 4, 0x004e4942, true);
  new Uint8Array(out, binHeader + 8, bin.length).set(bin);
  return out;
}

/** Closed tetrahedron with outward-facing triangles: 4 vertices, 4 faces, every edge shared twice. */
export const TETRAHEDRON = {
  positions: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
  indices: [0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3],
};
