// Visitors can evaluate their own .glb in the browser; bad files are refused with a clear message.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 1920, height: 1080 } });

const chair = readFileSync(fileURLToPath(new URL('../public/samples/sample-chair.glb', import.meta.url)));

async function open(page: Page): Promise<void> {
  await page.goto('/?clock=manual&sample=sample-monitor');
  await expect(page.locator('.app')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
}

async function advance(page: Page, ms: number): Promise<void> {
  await page.evaluate((n) => (window as unknown as { __nain: { advance(n: number): void } }).__nain.advance(n), ms);
  await page.waitForTimeout(250);
}

test('a visitor GLB is evaluated and shown', async ({ page }) => {
  await open(page);
  await page.locator('input[type="file"]').setInputFiles({ name: 'my-chair.glb', mimeType: 'model/gltf-binary', buffer: chair });
  await expect(page.locator('.app')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
  await advance(page, 6000);
  await expect(page.locator('.sample-chip')).toHaveText('my-chair.glb');
  await expect(page.locator('.verdict.visible .badge')).toContainText('Conforme');
});

test('files that are not .glb are refused', async ({ page }) => {
  await open(page);
  await page.locator('input[type="file"]').setInputFiles({ name: 'model.obj', mimeType: 'text/plain', buffer: Buffer.from('v 0 0 0') });
  await expect(page.getByRole('alert')).toContainText('Solo se admiten archivos .glb');
});

test('files over 25 MB are refused without being read', async ({ page }) => {
  await open(page);
  await page.locator('input[type="file"]').setInputFiles({ name: 'huge.glb', mimeType: 'model/gltf-binary', buffer: Buffer.alloc(26 * 1024 * 1024) });
  await expect(page.getByRole('alert')).toContainText('supera los 25 MB');
});

test('a corrupt .glb is never approved', async ({ page }) => {
  await open(page);
  await page.locator('input[type="file"]').setInputFiles({ name: 'broken.glb', mimeType: 'model/gltf-binary', buffer: Buffer.from('this is not a glb file at all') });
  await expect(page.getByRole('alert')).toContainText('No se ha podido mostrar el modelo', { timeout: 30_000 });
  await advance(page, 6000);
  await expect(page.locator('.verdict.visible .badge')).toContainText('Incompleto');
  await expect(page.locator('.tone-bad')).toBeVisible();
});

test('English messages follow the language', async ({ page }) => {
  await page.goto('/?clock=manual&lang=en&sample=sample-monitor');
  await expect(page.locator('.app')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
  await page.locator('input[type="file"]').setInputFiles({ name: 'model.stl', mimeType: 'text/plain', buffer: Buffer.from('solid') });
  await expect(page.getByRole('alert')).toContainText('Only .glb files');
});
