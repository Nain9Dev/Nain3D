// PDF report: created in the browser from the verdict on screen, downloaded when the device cannot share files.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test.use({ viewport: { width: 1920, height: 1080 } });

async function ready(page: Page): Promise<void> {
  await expect(page.locator('.app')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
}

async function advance(page: Page, ms: number): Promise<void> {
  await page.evaluate((n) => (window as unknown as { __nain: { advance(n: number): void } }).__nain.advance(n), ms);
  await page.waitForTimeout(250);
}

async function open(page: Page, lang: string): Promise<void> {
  await page.goto(`/?clock=manual&lang=${lang}&sample=sample-shoe`);
  await ready(page);
  await advance(page, 6000);
}

async function pdfText(path: string): Promise<string> {
  return (await readFile(path)).toString('latin1');
}

test('creates a one-page PDF with the verdict and the optional fields', async ({ page }) => {
  await open(page, 'es');
  await page.getByRole('button', { name: 'Informe PDF' }).click();
  await page.getByLabel('Empresa (opcional)').fill('Tienda Demo');
  await page.getByLabel('Referencia o pedido (opcional)').fill('PED-1042');

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
  expect(results.violations).toEqual([]);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Crear y compartir' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^informe-nain3d-[0-9a-f]{8}\.pdf$/);
  const text = await pdfText((await download.path()) as string);
  expect(text.startsWith('%PDF-1.4')).toBe(true);
  expect(text).toContain('Tienda Demo');
  expect(text).toContain('PED-1042');
  expect(text).toContain('/DCTDecode');
  await expect(page.getByRole('status').filter({ hasText: 'Informe creado.' })).toBeVisible();
});

test('the report follows the interface language', async ({ page }) => {
  await open(page, 'en');
  await page.getByRole('button', { name: 'PDF report' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Create and share' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^report-nain3d-[0-9a-f]{8}\.pdf$/);
});
