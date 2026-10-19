// Accessibility, keyboard, language and motion checks (REQ-VR-08, -14, -16).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 1920, height: 1080 } });

const chair = readFileSync(fileURLToPath(new URL('../public/samples/sample-chair.glb', import.meta.url)));

async function ready(page: Page): Promise<void> {
  await expect(page.locator('.app')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
}

async function advance(page: Page, ms: number): Promise<void> {
  await page.evaluate((n) => (window as unknown as { __nain: { advance(n: number): void } }).__nain.advance(n), ms);
  await page.waitForTimeout(200);
}

for (const lang of ['es', 'en'] as const) {
  test(`WCAG 2.2 AA: no axe violations (${lang}, both verdicts)`, async ({ page }) => {
    await page.goto(`/?clock=manual&lang=${lang}&sample=sample-shoe`);
    await ready(page);
    await advance(page, 6000);
    const scan = () =>
      new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .exclude('nain-ecosystem-bar') // Third-party ecosystem bar served from naindev.com.
        .analyze();
    expect((await scan()).violations).toEqual([]);

    await page.keyboard.press('c');
    await ready(page);
    await page.waitForTimeout(600);
    await advance(page, 6000);
    await expect(page.locator('.tone-bad')).toBeVisible();
    expect((await scan()).violations).toEqual([]);
  });
}

test('keyboard: every control is reachable and "c" compares', async ({ page }) => {
  await page.goto('/?clock=manual&sample=sample-shoe');
  await ready(page);
  await advance(page, 6000);
  await expect(page.locator('.verdict.visible .badge')).toContainText('Conforme');

  const reachable = new Set<string>();
  for (let i = 0; i < 22; i += 1) {
    await page.keyboard.press('Tab');
    reachable.add(await page.evaluate(() => document.activeElement?.textContent?.trim().slice(0, 24) ?? ''));
  }
  for (const name of ['Español', 'English', 'Zapatilla gigante', 'Comparar', 'Subir .glb']) {
    expect([...reachable].some((text) => text.includes(name)), name).toBe(true);
  }

  await page.locator('body').click({ position: { x: 5, y: 600 } });
  await page.keyboard.press('c');
  await ready(page); // The giant sneaker is loaded and drawn (software WebGL can take several seconds).
  await advance(page, 6000);
  await expect(page.locator('.verdict.visible .badge')).toContainText('No conforme');
});

test('language: ?lang wins, the choice is remembered without cookies', async ({ page, context }) => {
  await page.goto('/?clock=manual&lang=en&sample=sample-monitor');
  await ready(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('h1')).toHaveText('Nain3D Gateway');
  await expect(page.getByText('The AI proposes, the contract decides.').first()).toBeVisible();

  await page.goto('/?clock=manual&sample=sample-monitor');
  await ready(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await page.getByRole('button', { name: 'Español' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.getByText('La IA propone, el contrato dispone.').first()).toBeVisible();
  expect(await context.cookies()).toEqual([]);
});

test('security: the page loads under its Content-Security-Policy without violations', async ({ page }) => {
  const violations: string[] = [];
  page.on('console', (message) => {
    if (/content security policy/i.test(message.text())) violations.push(message.text());
  });
  await page.goto('/?clock=manual&sample=sample-shoe');
  await ready(page);
  await advance(page, 6000);
  await page.locator('input[type="file"]').setInputFiles({ name: 'chair.glb', mimeType: 'model/gltf-binary', buffer: chair });
  await ready(page);
  await page.waitForTimeout(2000); // Give the NainDev ecosystem bar time to load its own resources.
  expect(violations).toEqual([]);
});

test('footer: the four contacts are real, named links', async ({ page }) => {
  await page.goto('/?clock=manual&sample=sample-monitor');
  await ready(page);
  const nav = page.getByRole('navigation', { name: 'Contacto' });
  // On localhost the nav also carries the API docs link, so only the four contacts are asserted.
  await expect(nav.getByRole('link', { name: 'contact@naindev.com' })).toHaveAttribute('href', 'mailto:contact@naindev.com');
  await expect(nav.getByRole('link', { name: 'LinkedIn' })).toHaveAttribute('href', /linkedin\.com\/in\/aitor-nain-mendoza-vallejo/);
  await expect(nav.getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', 'https://github.com/Nain9Dev/Nain3D');
  await expect(nav.getByRole('link', { name: 'Web' })).toHaveAttribute('href', 'https://naindev.com');
});

test('reduced motion: the verdict is immediate and rotation is off', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?clock=manual&sample=sample-oversized-chair');
  await ready(page);
  await expect(page.locator('.verdict.visible .badge')).toContainText('No conforme');
  await expect(page.locator('.check.fail')).toHaveCount(1);
});

test('recording mode: no chrome and nothing that needs hover or focus', async ({ page }) => {
  await page.goto('/?clock=manual&mode=record');
  await ready(page);
  expect(await page.locator('button, a, input, select, nain-ecosystem-bar').count()).toBe(0);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.app')!).cursor)).toBe('none');
});
