// Generates the four hero sample models (deterministic, zero cost, no external assets).
// Run: npm run generate:samples
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertClosedSolid,
  cylinder,
  roundedBox,
  rotateY,
  rotateZ,
  scale,
  sphere,
  torus,
  translate,
  weld,
} from './lib/geometry.mjs';
import { encodePng, writeGlb } from './lib/glb.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'public', 'samples');
mkdirSync(outDir, { recursive: true });

// Linear-space factors. Brand blue #0047AB, brand red #FF001F, brand green #80FF00.
const MATERIALS = {
  aluminium: { pbr: { baseColorFactor: [0.82, 0.84, 0.88, 1], metallicFactor: 1, roughnessFactor: 0.32 } },
  plastic: { pbr: { baseColorFactor: [0.04, 0.045, 0.05, 1], metallicFactor: 0.1, roughnessFactor: 0.55 } },
  screen: {
    pbr: { baseColorFactor: [0, 0, 0.02, 1], metallicFactor: 0, roughnessFactor: 0.08 },
    emissiveImage: 'screen',
  },
  chrome: { pbr: { baseColorFactor: [0.9, 0.9, 0.92, 1], metallicFactor: 1, roughnessFactor: 0.12 } },
  fabric: { pbr: { baseColorFactor: [0, 0.063, 0.407, 1], metallicFactor: 0, roughnessFactor: 0.85 } },
  brass: { pbr: { baseColorFactor: [0.72, 0.45, 0.15, 1], metallicFactor: 1, roughnessFactor: 0.3 } },
  steel: { pbr: { baseColorFactor: [0.55, 0.57, 0.6, 1], metallicFactor: 1, roughnessFactor: 0.4 } },
  signalRed: { pbr: { baseColorFactor: [1, 0, 0.014, 1], metallicFactor: 0, roughnessFactor: 0.45 } },
};

function screenImage() {
  const w = 512;
  const h = 288;
  const px = new Uint8Array(w * h * 4);
  const set = (x, y, c) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const o = (y * w + x) * 4;
    px[o] = c[0];
    px[o + 1] = c[1];
    px[o + 2] = c[2];
    px[o + 3] = 255;
  };
  for (let y = 0; y < h; y += 1) {
    const t = y / (h - 1);
    for (let x = 0; x < w; x += 1) set(x, y, [Math.round(2 + 0 * t), Math.round(20 + 51 * t), Math.round(46 + 125 * t)]);
  }
  const rect = (x0, y0, x1, y1, c) => {
    for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) set(x, y, c);
  };
  rect(0, 0, w, 28, [0, 24, 58]);
  rect(16, 10, 96, 18, [128, 255, 0]);
  const bars = [90, 140, 110, 180, 150, 210, 170];
  bars.forEach((bh, i) => rect(40 + i * 62, h - 30 - bh, 76 + i * 62, h - 30, [128, 255, 0]));
  for (let x = 40; x < 470; x += 1) {
    const y = Math.round(120 - 60 * Math.sin(x / 55) - x / 12);
    rect(x, y, x + 1, y + 3, [237, 241, 246]);
  }
  return encodePng(w, h, px);
}

function chairParts() {
  const legs = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      legs.push({
        name: `leg-${sx}-${sz}`,
        material: 'chrome',
        geo: translate(cylinder(0.022, 0, 0.44, 10), [0.24 * sx, 0, 0.21 * sz]),
      });
    }
  }
  return [
    { name: 'seat', material: 'fabric', geo: roundedBox(0.56, 0.07, 0.52, 0.02, 2, [0, 0.475, 0]) },
    { name: 'back', material: 'fabric', geo: roundedBox(0.54, 0.46, 0.05, 0.02, 1, [0, 0.76, -0.235]) },
    ...legs,
  ];
}

function valveParts() {
  const alongX = (g, x, y, z) => translate(rotateZ(g, Math.PI / 2), [x, y, z]);
  const parts = [];
  parts.push({ name: 'body', material: 'brass', geo: sphere(0.21, 0.2, 48, 24) });
  parts.push({ name: 'pipe', material: 'steel', geo: alongX(cylinder(0.09, -0.35, 0.35, 40), 0, 0.2, 0) });
  for (const side of [-1, 1]) {
    parts.push({
      name: `flange-${side}`,
      material: 'steel',
      geo: alongX(cylinder(0.17, -0.03, 0.03, 48), 0.32 * side, 0.2, 0),
    });
    for (let k = 0; k < 8; k += 1) {
      const a = (k / 8) * Math.PI * 2;
      parts.push({
        name: `bolt-${side}-${k}`,
        material: 'chrome',
        geo: alongX(cylinder(0.012, -0.02, 0.02, 6), 0.35 * side, 0.2 + 0.13 * Math.cos(a), 0.13 * Math.sin(a)),
      });
    }
  }
  parts.push({ name: 'bonnet', material: 'steel', geo: cylinder(0.09, 0.36, 0.46, 40) });
  parts.push({ name: 'neck', material: 'brass', geo: cylinder(0.045, 0.46, 0.62, 32) });
  parts.push({ name: 'stem', material: 'chrome', geo: cylinder(0.014, 0.62, 0.8, 16) });
  parts.push({ name: 'hub', material: 'signalRed', geo: cylinder(0.04, 0.72, 0.78, 32) });
  parts.push({ name: 'wheel', material: 'signalRed', geo: torus(0.16, 0.016, 0.75, 64, 12) });
  for (let k = 0; k < 3; k += 1) {
    const spoke = rotateY(translate(rotateZ(cylinder(0.01, -0.16, 0.16, 12), Math.PI / 2), [0, 0.75, 0]), (k * Math.PI) / 3);
    parts.push({ name: `spoke-${k}`, material: 'signalRed', geo: spoke });
  }
  return parts;
}

function monitorParts() {
  return [
    { name: 'panel', material: 'aluminium', geo: roundedBox(0.9, 0.55, 0.035, 0.012, 2, [0, 0.46, 0]) },
    {
      name: 'screen',
      material: 'screen',
      geo: roundedBox(0.84, 0.49, 0.004, 0.0015, 1, [0, 0.46, 0.0185], { screenUv: true }),
    },
    { name: 'neck', material: 'plastic', geo: translate(cylinder(0.025, 0.02, 0.2, 20), [0, 0, -0.04]) },
    { name: 'base', material: 'aluminium', geo: roundedBox(0.3, 0.016, 0.2, 0.006, 1, [0, 0.008, 0]) },
  ];
}

function oversizedChairParts() {
  const chair = chairParts();
  const height = 0.99;
  const k = 5.0 / height; // Bakes the scale: max extent becomes exactly 5.0 m.
  return chair.map((p) => ({ ...p, geo: scale(p.geo, k) }));
}

const SAMPLES = {
  'sample-monitor': { parts: monitorParts(), images: { screen: screenImage() } },
  'sample-chair': { parts: chairParts() },
  'sample-industrial': { parts: valveParts() },
  'sample-oversized-chair': { parts: oversizedChairParts() },
};

for (const [id, def] of Object.entries(SAMPLES)) {
  let triangles = 0;
  for (const part of def.parts) {
    // The screen keeps its UV seams; every other part is welded so the engine sees closed solids.
    if (part.material !== 'screen') part.geo = weld(part.geo);
    assertClosedSolid(part.geo, `${id}/${part.name}`);
    triangles += part.geo.idx.length / 3;
  }
  const used = new Set(def.parts.map((p) => p.material));
  const materials = Object.fromEntries(Object.entries(MATERIALS).filter(([name]) => used.has(name)));
  if (materials.screen) materials.screen = { ...materials.screen };
  const glb = writeGlb({ name: id, parts: def.parts, materials, images: def.images });
  writeFileSync(join(outDir, `${id}.glb`), glb);
  console.log(`${id}: ${triangles} triangles, ${glb.length} bytes`);
}
