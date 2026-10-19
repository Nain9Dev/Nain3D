// Renders the recording sequence offline, frame by frame, into an MP4 (needs ffmpeg on the PATH).
// The page runs with a manual clock, so the video is identical on every run and never drops frames.
//
// Usage: node scripts/render-video.mjs [--url http://localhost:5376] [--format vertical|horizontal]
//          [--lang es|en] [--fps 30] [--seconds <limit>] [--out out/nain3d-vertical-es.mp4]
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { chromium } from '@playwright/test';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]] : null))
    .filter(Boolean),
);
const url = args.url ?? 'http://localhost:5376';
const format = args.format ?? 'vertical';
const lang = args.lang ?? 'es';
const fps = Number(args.fps ?? 30);
const out = args.out ?? `out/nain3d-${format}-${lang}.mp4`;
const size = format === 'horizontal' ? { width: 1920, height: 1080 } : { width: 1080, height: 1920 };

const ffmpeg = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
if (ffmpeg.error) {
  console.error('ffmpeg was not found on the PATH.');
  process.exit(2);
}

const frames = mkdtempSync(join(tmpdir(), 'nain3d-frames-'));
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
try {
  const page = await (await browser.newContext({ viewport: size })).newPage();
  await page.goto(`${url}/?mode=record&clock=manual&lang=${lang}`);
  const ready = () => page.waitForSelector('.app[data-ready="true"]', { timeout: 120_000 });
  await ready();

  const total = await page.evaluate((f) => window.__nain.frameCount(f), fps);
  const count = args.seconds ? Math.min(total, Math.ceil(Number(args.seconds) * fps)) : total;
  const stepMs = 1000 / fps;
  for (let i = 0; i < count; i += 1) {
    if (i > 0) await page.evaluate((ms) => window.__nain.advance(ms), stepMs);
    await ready(); // A model switch (second sample) pauses the export until the new model is drawn.
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.screenshot({ path: join(frames, `${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 });
    if (i % fps === 0) console.log(`frame ${i}/${count}`);
  }

  mkdirSync(dirname(out), { recursive: true });
  const encode = spawnSync(
    'ffmpeg',
    ['-y', '-framerate', String(fps), '-i', join(frames, '%05d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', out],
    { stdio: 'inherit' },
  );
  if (encode.status !== 0) process.exit(encode.status ?? 1);
  console.log(`wrote ${out} (${count} frames at ${fps} fps)`);
} finally {
  await browser.close();
  rmSync(frames, { recursive: true, force: true });
}
