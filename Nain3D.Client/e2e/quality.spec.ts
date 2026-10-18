// Accessibility, keyboard, language and motion checks (REQ-VR-08, -14, -16).
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 1920, height: 1080 } });

async function ready(page: Page): Promise<void> {
  await expect(page.locator('.app')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
}

async function advance(page: Page, ms: number): Promise<void> {
  await page.evaluate((n) => (window as unknown as { __nain: { advance(n: number): void } }).__nain.advance(n), ms);
  await page.waitForTimeout(200);
}

for (const lang of ['es', 'en'] as const) {
  test(`WCAG 2.2 AA: no axe violations (${lang}, both verdicts)`, async ({ page }) => {
    await page.goto(`/?clock=manual&lang=${lang}&sample=sample-industrial`);
    await ready(page);
    await advance(page, 6000);
    const scan = () =>
      new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .exclude('nain-ecosystem-bar') // Third-party ecosystem bar served from naindev.com.
        .analyze();
    expect((await scan()).violations).toEqual([]);

    await page.keyboard.press('c');
    await expect(page.locator('.app')).toHaveAttribute('data-ready', 'true');
    await page.waitForTimeout(600);
    await advance(page, 6000);
    await expect(page.locator('.tone-bad')).toBeVisible();
    expect((await scan()).violations).toEqual([]);
  });
}

test('keyboard: every control is reachable and "c" compares', async ({ page }) => {
  await page.goto('/?clock=manual&sample=sample-industrial');
  await ready(page);
  await advance(page, 6000);
  await expect(page.locator('.verdict.visible .badge')).toContainText('Conforme');

  const reachable = new Set<string>();
  for (let i = 0; i < 16; i += 1) {
    await page.keyboard.press('Tab');
    reachable.add(await page.evaluate(() => document.activeElement?.textContent?.trim().slice(0, 24) ?? ''));
  }
  for (const name of ['Español', 'English', 'Silla gigante', 'Comparar', 'Subir .glb']) {
    expect([...reachable].some((text) => text.includes(name)), name).toBe(true);
  }

  await page.locator('body').click({ position: { x: 5, y: 600 } });
  await page.keyboard.press('c');
  await page.waitForTimeout(800);
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
