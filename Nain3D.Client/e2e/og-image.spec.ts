// Regenerates the 1200x630 social preview from the recording layout (no mask, no chrome).
// Run: npm run build && npx playwright test e2e/og-image.spec.ts
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import sharp from 'sharp';

const OUT = fileURLToPath(new URL('../public/og-image.png', import.meta.url));
const README_IMAGE = fileURLToPath(new URL('../../docs/assets/demo-en.png', import.meta.url));

test.use({ viewport: { width: 1920, height: 1080 } });

test('social preview image', async ({ page }) => {
  await page.goto('/?clock=manual&mode=record&sample=sample-shoe&lang=es');
  await expect(page.locator('.app')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
  await page.evaluate(() => (window as unknown as { __nain: { advance(n: number): void } }).__nain.advance(6500));
  await page.waitForTimeout(500);
  const frame = await page.screenshot();
  // 1920x1080 -> 1200x675, then centre-crop to 630 rows.
  await sharp(frame).resize(1200, 630, { fit: 'cover', position: 'centre' }).png({ compressionLevel: 9 }).toFile(OUT);
});

test('README screenshot (English, unmasked)', async ({ page }) => {
  await page.goto('/?clock=manual&mode=record&sample=sample-shoe&lang=en');
  await expect(page.locator('.app')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
  await page.evaluate(() => (window as unknown as { __nain: { advance(n: number): void } }).__nain.advance(6500));
  await page.waitForTimeout(500);
  const frame = await page.screenshot();
  await sharp(frame).resize(1280, 720).png({ compressionLevel: 9 }).toFile(README_IMAGE);
});
