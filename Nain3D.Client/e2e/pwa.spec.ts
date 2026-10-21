// Installable app: a valid manifest and an offline shell that never stores API calls or the user's files.
import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 800 } });

async function ready(page: Page): Promise<void> {
  await expect(page.locator('.app')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
}

test('the manifest describes an installable standalone app with real icons', async ({ page, request }) => {
  await page.goto('/?clock=manual&sample=sample-shoe');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const response = await request.get(href as string);
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.start_url).toBe('./');
  expect(manifest.name).toBeTruthy();
  const purposes = manifest.icons.map((icon: { sizes: string; purpose: string }) => `${icon.sizes}:${icon.purpose}`);
  expect(purposes).toEqual(expect.arrayContaining(['192x192:any', '512x512:any', '512x512:maskable']));
  for (const icon of manifest.icons as { src: string }[]) {
    const file = await request.get(`/${icon.src}`);
    expect(file.ok()).toBe(true);
    expect(file.headers()['content-type']).toContain('image/png');
  }
});

test('after a first visit the app opens offline and reviews a sample', async ({ page, context }) => {
  await page.goto('/?clock=manual&sample=sample-shoe');
  await ready(page);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  // The worker takes control after activation; wait until it does.
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  await context.setOffline(true);
  await page.goto('/?clock=manual&sample=sample-shoe');
  await ready(page);
  await page.evaluate((n) => (window as unknown as { __nain: { advance(n: number): void } }).__nain.advance(n), 6000);
  await expect(page.locator('.verdict.visible .badge')).toContainText('Conforme');
  await context.setOffline(false);
});

test('the worker never caches API calls, other origins or non-GET requests', async ({ page }) => {
  await page.goto('/?clock=manual&sample=sample-shoe');
  await ready(page);
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      for (const request of await (await caches.open(name)).keys()) urls.push(request.url);
    }
    return urls;
  });
  expect(cached.length).toBeGreaterThan(5);
  expect(cached.some((url) => url.includes('/api/') || url.includes('/health'))).toBe(false);
  expect(cached.every((url) => url.startsWith(new URL(page.url()).origin))).toBe(true);
  expect(cached.some((url) => url.endsWith('.glb'))).toBe(true); // Bundled samples only.
  expect(cached.some((url) => url.endsWith('sw.js'))).toBe(false);
});
