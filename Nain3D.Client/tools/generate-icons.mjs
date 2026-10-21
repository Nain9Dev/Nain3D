// Renders the installable-app icons from one cube mark. Run: npm run generate:icons
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
const BACKGROUND = '#0c1222';
const GREEN = '#80ff00';

/** The cube mark from the favicon, centred; `scale` shrinks it to keep a maskable icon inside its safe zone. */
function svg(size, scale) {
  const mark = size * scale;
  const offset = (size - mark) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BACKGROUND}"/>
  <g transform="translate(${offset} ${offset}) scale(${mark / 24})" fill="none" stroke="${GREEN}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
    <line x1="12" y1="22.08" x2="12" y2="12"/>
  </g>
</svg>`;
}

const targets = [
  { file: 'icon-192.png', size: 192, scale: 0.7 },
  { file: 'icon-512.png', size: 512, scale: 0.7 },
  // Maskable icons may be cropped to a circle: the mark stays inside the central 60%.
  { file: 'icon-maskable-512.png', size: 512, scale: 0.5 },
  { file: 'apple-touch-icon.png', size: 180, scale: 0.7 },
];

await mkdir(out, { recursive: true });
for (const { file, size, scale } of targets) {
  await sharp(Buffer.from(svg(size, scale))).png({ compressionLevel: 9 }).toFile(join(out, file));
  console.log(`icons/${file}`);
}
