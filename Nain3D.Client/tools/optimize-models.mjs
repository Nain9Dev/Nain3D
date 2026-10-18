// Turns third-party source models (kept outside the repository) into web-ready sample GLBs.
// Run: npm run optimize:models   (source folder: $NAIN3D_ASSETS_DIR or D:/3D-Assets)
//
// What it does, in order: checks the source SHA-256 against tools/model-sources.json, keeps one material
// variant, bakes node transforms (and an optional scale) into the vertices, resizes textures and
// re-encodes them as JPEG, prunes unused data. Geometry is left uncompressed on purpose: the Python
// engine cannot decode Draco or meshopt, so the same bytes must evaluate identically in both engines.
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, flatten, getBounds, prune, textureCompress, transformMesh } from '@gltf-transform/functions';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(here, 'model-sources.json'), 'utf8'));
const assetsDir = process.env[config.assetsDirEnv] ?? config.assetsDirDefault;
const outDir = join(here, '..', 'public', 'samples');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** Column-major 4x4 premultiplied by a uniform scale: every entry of rows 0-2 is multiplied by k. */
const scaled = (matrix, k) => matrix.map((v, i) => (i % 4 < 3 ? v * k : v));

async function build(model) {
  const bytes = readFileSync(join(assetsDir, model.file));
  const sha = createHash('sha256').update(bytes).digest('hex');
  if (sha !== model.sha256) throw new Error(`${model.id}: source hash mismatch (${sha})`);

  const doc = await io.readBinary(new Uint8Array(bytes));
  const root = doc.getRoot();

  // One look only: dropping the variants extension lets prune() remove the other colourways' textures.
  for (const ext of root.listExtensionsUsed()) {
    if (ext.extensionName === 'KHR_materials_variants') ext.dispose();
  }

  await doc.transform(flatten());
  const scene = root.listScenes()[0];
  let factor = 1;
  if (model.scaleToMaxExtentM) {
    const { min, max } = getBounds(scene);
    factor = model.scaleToMaxExtentM / Math.max(...max.map((v, i) => v - min[i]));
  }
  // The in-browser evaluator reads POSITION bounds and ignores node transforms, so bake everything.
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    transformMesh(mesh, scaled(node.getWorldMatrix(), factor));
    node.setMatrix(IDENTITY);
  }

  await doc.transform(
    prune(),
    dedup(),
    textureCompress({
      encoder: sharp,
      targetFormat: 'jpeg',
      resize: [model.textureSize, model.textureSize],
      quality: 85,
    }),
  );

  const outPath = join(outDir, `${model.id}.glb`);
  await io.write(outPath, doc);
  const { min, max } = getBounds(doc.getRoot().listScenes()[0]);
  const extents = max.map((v, i) => +(v - min[i]).toFixed(4));
  console.log(`${model.id}: ${statSync(outPath).size} bytes, extents ${extents.join(' x ')} m`);
}

for (const model of config.models) await build(model);
