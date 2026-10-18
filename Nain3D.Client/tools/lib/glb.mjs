// Minimal deterministic GLB writer (glTF 2.0, one node, one mesh, one primitive per part).
import { deflateSync } from 'node:zlib';

function pad4(buf, fill = 0) {
  const rest = buf.length % 4;
  return rest === 0 ? buf : Buffer.concat([buf, Buffer.alloc(4 - rest, fill)]);
}

function crc32(buf) {
  let c;
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n += 1) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Encodes an RGBA pixel array as a PNG. Deterministic for a given Node/zlib version. */
export function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * @param {{name:string, parts:{name:string, material:string, geo:object}[],
 *          materials:Record<string, object>, images?:Record<string, Buffer>}} model
 */
export function writeGlb(model) {
  const chunks = [];
  let offset = 0;
  const bufferViews = [];
  const accessors = [];

  const addView = (buf, target) => {
    const padded = pad4(buf);
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: buf.length, ...(target ? { target } : {}) });
    chunks.push(padded);
    offset += padded.length;
    return bufferViews.length - 1;
  };
  const addAccessor = (view, componentType, count, type, bounds) => {
    accessors.push({ bufferView: view, componentType, count, type, ...(bounds ?? {}) });
    return accessors.length - 1;
  };

  const primitives = model.parts.map((part) => {
    const { pos, nrm, uv, idx } = part.geo;
    let min = [Infinity, Infinity, Infinity];
    let max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < pos.length; i += 3) {
      for (let a = 0; a < 3; a += 1) {
        min[a] = Math.min(min[a], Math.fround(pos[i + a]));
        max[a] = Math.max(max[a], Math.fround(pos[i + a]));
      }
    }
    const f32 = (arr) => Buffer.from(new Float32Array(arr).buffer);
    const position = addAccessor(addView(f32(pos), 34962), 5126, pos.length / 3, 'VEC3', { min, max });
    const normal = addAccessor(addView(f32(nrm), 34962), 5126, nrm.length / 3, 'VEC3');
    const texcoord = addAccessor(addView(f32(uv), 34962), 5126, uv.length / 2, 'VEC2');
    const indices = addAccessor(addView(Buffer.from(new Uint32Array(idx).buffer), 34963), 5125, idx.length, 'SCALAR');
    return {
      attributes: { POSITION: position, NORMAL: normal, TEXCOORD_0: texcoord },
      indices,
      material: Object.keys(model.materials).indexOf(part.material),
      mode: 4,
    };
  });

  const imageNames = Object.keys(model.images ?? {});
  const images = imageNames.map((name) => ({
    bufferView: addView(model.images[name]),
    mimeType: 'image/png',
    name,
  }));

  const materials = Object.entries(model.materials).map(([name, m]) => {
    const material = { name, pbrMetallicRoughness: m.pbr, ...(m.extra ?? {}) };
    if (m.emissiveImage) {
      material.emissiveTexture = { index: imageNames.indexOf(m.emissiveImage) };
      material.emissiveFactor = [1, 1, 1];
    }
    if (m.baseImage) {
      material.pbrMetallicRoughness = {
        ...m.pbr,
        baseColorTexture: { index: imageNames.indexOf(m.baseImage) },
      };
    }
    return material;
  });

  const json = {
    asset: { version: '2.0', generator: 'nain3d-sample-generator' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: model.name, mesh: 0 }],
    meshes: [{ name: model.name, primitives }],
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength: offset }],
    ...(images.length
      ? { images, textures: images.map((_, i) => ({ source: i, sampler: 0 })), samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }] }
      : {}),
  };

  const jsonBuf = pad4(Buffer.from(JSON.stringify(json), 'utf8'), 0x20);
  const binBuf = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + binBuf.length, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonBuf.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binBuf.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHeader, jsonBuf, binHeader, binBuf]);
}
