// Key-state captures used by the docs and the recording script (REQ-VR-18).
// Run: npm run build && npm run test:e2e   (files land in ../docs/assets/visual-redesign/after/)
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

const OUT = fileURLToPath(new URL('../../docs/assets/visual-redesign/after/', import.meta.url));
mkdirSync(OUT, { recursive: true });

const FORMATS = {
  horizontal: { width: 1920, height: 1080 },
  vertical: { width: 1080, height: 1920 },
} as const;

async function open(page: Page, query: string): Promise<void> {
  await page.goto(`/?clock=manual&${query}`);
  await expect(page.locator('.app')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
}

async function advance(page: Page, ms: number): Promise<void> {
  await page.evaluate((n) => (window as unknown as { __nain: { advance(n: number): void } }).__nain.advance(n), ms);
  await page.waitForTimeout(250); // Let Vue flush and the WebGL frame present.
}

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${OUT}${name}.png`, mask: [page.locator('.latency')] });
}

for (const lang of ['es', 'en'] as const) {
  test.describe(`standard ${lang}`, () => {
    test.use({ viewport: FORMATS.horizontal });

    test('start, conformant, non-conformant', async ({ page }) => {
      await open(page, `lang=${lang}&sample=sample-shoe`);
      await advance(page, 800);
      await shot(page, `standard-${lang}-1-start`);
      await advance(page, 5200);
      await shot(page, `standard-${lang}-2-conformant`);

      await page.getByRole('button', { name: /zapatilla gigante|giant sneaker/i }).click();
      await expect(page.locator('.app')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
      await page.waitForTimeout(800);
      await advance(page, 6500);
      await shot(page, `standard-${lang}-3-non-conformant`);
    });
  });

  for (const [format, size] of Object.entries(FORMATS)) {
    test.describe(`record ${format} ${lang}`, () => {
      test.use({ viewport: size });

      test('hook, checks, verdicts and end card', async ({ page }) => {
        await open(page, `mode=record&lang=${lang}`);
        await advance(page, 1200);
        await shot(page, `record-${format}-${lang}-1-hook`);
        await advance(page, 2600);
        await shot(page, `record-${format}-${lang}-2-checks`);
        await advance(page, 2600);
        await shot(page, `record-${format}-${lang}-3-conformant`);
        await advance(page, 4000); // t = 10.4 s: second segment started
        await expect(page.locator('.app')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
        await advance(page, 5200);
        await shot(page, `record-${format}-${lang}-4-non-conformant`);
        await advance(page, 4000);
        await shot(page, `record-${format}-${lang}-5-end-card`);
        const card = page.locator('.endcard');
        await expect(card).toContainText('Aitor Nain');
        await expect(card).toContainText(lang === 'es' ? 'Arquitecto de software full stack' : 'Full stack software architect');
        for (const value of ['naindev.com', 'contact@naindev.com', 'in/aitor-nain-mendoza-vallejo', 'github.com/Nain9Dev/Nain3D']) {
          await expect(card).toContainText(value);
        }
        // Every line of the card must sit inside the safe zones (vertical: 230 px top, 340 px bottom).
        const box = await page.locator('.endcard-line').first().boundingBox();
        const last = await page.locator('.endcard-contacts li').last().boundingBox();
        if (format === 'vertical' && box && last) {
          expect(box.y).toBeGreaterThanOrEqual(230);
          expect(last.y + last.height).toBeLessThanOrEqual(1920 - 340);
        }

        const overflow = await page.evaluate(() => ({
          x: document.documentElement.scrollWidth - window.innerWidth,
          y: document.documentElement.scrollHeight - window.innerHeight,
        }));
        expect(overflow.x).toBeLessThanOrEqual(0);
        expect(overflow.y).toBeLessThanOrEqual(0);
      });
    });
  }
}
