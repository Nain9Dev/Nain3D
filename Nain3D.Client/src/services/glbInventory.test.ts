import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readImageSize, readInventory } from './glbInventory';

const bytes = (...parts: (number[] | Uint8Array)[]) => Uint8Array.from(parts.flatMap((p) => [...p]));
const u32be = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u16be = (n: number) => [(n >>> 8) & 255, n & 255];
const u24le = (n: number) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255];
const text = (s: string) => [...s].map((c) => c.charCodeAt(0));

const png = (w: number, h: number) =>
  bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], u32be(13), text('IHDR'), u32be(w), u32be(h), [8, 6, 0, 0, 0]);
const jpeg = (w: number, h: number) =>
  bytes([0xff, 0xd8, 0xff, 0xe0], u16be(16), text('JFIF'), [0, 1, 1, 0, 0, 1, 0, 1, 0, 0], [0xff, 0xc0], u16be(17), [8], u16be(h), u16be(w), [3, 1, 0x11, 0, 2, 0x11, 0, 3, 0x11, 0]);
const webp = (w: number, h: number) =>
  bytes(text('RIFF'), [22, 0, 0, 0], text('WEBP'), text('VP8X'), [10, 0, 0, 0], [0, 0, 0, 0], u24le(w - 1), u24le(h - 1));

function glb(gltf: object, bin: Uint8Array = new Uint8Array(0)): ArrayBuffer {
  const json = new TextEncoder().encode(JSON.stringify(gltf));
  const jsonPadded = new Uint8Array(Math.ceil(json.length / 4) * 4).fill(0x20);
  jsonPadded.set(json);
  const binPadded = new Uint8Array(Math.ceil(bin.length / 4) * 4);
  binPadded.set(bin);
  const total = 12 + 8 + jsonPadded.length + (binPadded.length ? 8 + binPadded.length : 0);
  const out = new ArrayBuffer(total);
  const view = new DataView(out);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonPadded.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(out, 20, jsonPadded.length).set(jsonPadded);
  if (binPadded.length) {
    view.setUint32(20 + jsonPadded.length, binPadded.length, true);
    view.setUint32(24 + jsonPadded.length, 0x004e4942, true);
    new Uint8Array(out, 28 + jsonPadded.length, binPadded.length).set(binPadded);
  }
  return out;
}

describe('readImageSize', () => {
  it('reads PNG, JPEG and WebP headers', () => {
    expect(readImageSize(png(1024, 512))).toEqual([1024, 512]);
    expect(readImageSize(jpeg(2048, 1024))).toEqual([2048, 1024]);
    expect(readImageSize(webp(4096, 2048))).toEqual([4096, 2048]);
  });

  it('returns null for unknown or truncated data', () => {
    expect(readImageSize(new TextEncoder().encode('not an image'))).toBeNull();
    expect(readImageSize(png(10, 10).slice(0, 12))).toBeNull();
  });
});

describe('readInventory', () => {
  it('measures embedded and data-URI textures', () => {
    const image = png(2048, 1024);
    const dataUri = `data:image/png;base64,${Buffer.from(png(512, 512)).toString('base64')}`;
    const inv = readInventory(
      glb(
        {
          asset: { version: '2.0' },
          images: [{ bufferView: 0, mimeType: 'image/png' }, { uri: dataUri }],
          bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: image.length }],
          buffers: [{ byteLength: image.length }],
          materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }],
          meshes: [{ primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 1 }, material: 0 }] }],
        },
        image,
      ),
    );
    expect(inv).toMatchObject({ readable: true, textureMaxSidePx: 2048, materialCount: 1, texturedMaterialCount: 1, hasUvCoordinates: true });
  });

  it('cannot measure external images and says so', () => {
    const inv = readInventory(glb({ asset: { version: '2.0' }, images: [{ uri: 'textures/a.png' }], meshes: [] }));
    expect(inv).toMatchObject({ readable: true, textureMaxSidePx: null });
  });

  it('counts only referenced materials', () => {
    const inv = readInventory(
      glb({
        asset: { version: '2.0' },
        materials: [{}, {}, {}],
        meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }, { attributes: { POSITION: 0 }, material: 2 }] }],
      }),
    );
    expect(inv).toMatchObject({ materialCount: 2, hasUvCoordinates: false, texturedMaterialCount: 0 });
  });

  it('is unreadable for garbage', () => {
    expect(readInventory(new ArrayBuffer(8)).readable).toBe(false);
  });

  it.each([
    ['sample-shoe', 1024, 1, 1, true],
    ['sample-oversized-shoe', 1024, 1, 1, true],
    ['sample-monitor', 512, 3, 1, true],
    ['sample-chair', 0, 2, 0, true],
  ])('matches the Python engine on %s', (id, texture, materials, textured, uvs) => {
    const file = readFileSync(fileURLToPath(new URL(`../../public/samples/${id}.glb`, import.meta.url)));
    const inv = readInventory(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
    expect([inv.textureMaxSidePx, inv.materialCount, inv.texturedMaterialCount, inv.hasUvCoordinates]).toEqual([
      texture,
      materials,
      textured,
      uvs,
    ]);
  });
});
