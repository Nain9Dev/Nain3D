// Store profiles: created in the app, kept on the device, applied to the model on screen.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 1920, height: 1080 } });

async function ready(page: Page): Promise<void> {
  await expect(page.locator('.app')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
}

async function advance(page: Page, ms: number): Promise<void> {
  await page.evaluate((n) => (window as unknown as { __nain: { advance(n: number): void } }).__nain.advance(n), ms);
  await page.waitForTimeout(250);
}

async function open(page: Page, lang = 'es'): Promise<void> {
  await page.goto(`/?clock=manual&lang=${lang}&sample=sample-shoe`);
  await ready(page);
  await advance(page, 6000);
}

const openDialog = (page: Page) => page.getByRole('button', { name: /^(Perfiles|Profiles):/ }).click();

async function createProfile(page: Page, name: string, fields: Record<string, string>): Promise<void> {
  await page.getByRole('button', { name: 'Nuevo perfil' }).click();
  await page.getByLabel('Nombre').fill(name);
  for (const [label, value] of Object.entries(fields)) await page.getByLabel(label).fill(value);
  await page.getByRole('button', { name: 'Guardar' }).click();
}

test('a store profile with a texture limit rejects the sneaker and is remembered', async ({ page }) => {
  await open(page);
  await expect(page.locator('.verdict.visible .badge')).toContainText('Conforme');

  await openDialog(page);
  await createProfile(page, 'Tienda AR', { 'Textura máxima (px)': '512', 'Peso máximo (MB)': '5' });
  await expect(page.getByRole('listitem').filter({ hasText: 'Tienda AR' })).toBeVisible();
  await page.getByRole('listitem').filter({ hasText: 'Tienda AR' }).getByRole('button', { name: 'Usar' }).click();

  await ready(page);
  await advance(page, 7000);
  await expect(page.locator('.verdict.visible .badge')).toContainText('No conforme');
  await expect(page.locator('.check.fail')).toContainText('Resolución de texturas');
  await expect(page.locator('.check.fail .figures')).toContainText('1024 px de 512 px');
  await expect(page.getByRole('button', { name: /^Perfiles:/ })).toContainText('Tienda AR');

  await page.reload();
  await ready(page);
  await advance(page, 7000);
  await expect(page.getByRole('button', { name: /^Perfiles:/ })).toContainText('Tienda AR');
  await expect(page.locator('.verdict.visible .badge')).toContainText('No conforme');
});

test('invalid fields are explained and nothing is saved', async ({ page }) => {
  await open(page);
  await openDialog(page);
  await page.getByRole('button', { name: 'Nuevo perfil' }).click();
  await page.getByLabel('Nombre').fill('');
  await page.getByLabel('Textura máxima (px)').fill('4');
  await page.getByLabel('Peso máximo (MB)').fill('-1');
  await page.getByRole('button', { name: 'Guardar' }).click();

  await expect(page.getByRole('alert').first()).toContainText('Revisa los campos marcados');
  await expect(page.getByText('Escribe un nombre de 1 a 80 caracteres.')).toBeVisible();
  await expect(page.getByText('Un entero entre 16 y 65.536, o vacío.')).toBeVisible();
  await expect(page.getByLabel('Nombre')).toHaveAttribute('aria-invalid', 'true');

  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByText('Aún no tienes perfiles propios')).toBeVisible();
});

test('a profile can be duplicated and deleted, and deleting the active one returns to automatic', async ({ page }) => {
  await open(page);
  await openDialog(page);
  await createProfile(page, 'Mi tienda', {});
  await page.getByRole('button', { name: 'Duplicar: Mi tienda' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Mi tienda (2)' })).toBeVisible();

  await page.getByRole('listitem').filter({ hasText: 'Mi tienda (2)' }).getByRole('button', { name: 'Usar' }).click();
  await ready(page);
  await openDialog(page);
  await page.getByRole('button', { name: 'Borrar: Mi tienda (2)' }).click();
  await expect(page.getByText('¿Borrar «Mi tienda (2)»?')).toBeVisible();
  await page.getByRole('button', { name: 'Sí, borrar' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Mi tienda (2)' })).toHaveCount(0);
  await expect(page.getByRole('listitem').filter({ hasText: 'Automático' }).getByRole('button')).toContainText('En uso');
});

test('the dialog has no axe violations and is operated with the keyboard', async ({ page }) => {
  await open(page);
  await openDialog(page);
  const scan = () => new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).exclude('nain-ecosystem-bar').analyze();
  expect((await scan()).violations).toEqual([]);

  await page.getByRole('button', { name: 'Nuevo perfil' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Nombre')).toBeVisible();
  expect((await scan()).violations).toEqual([]);

  await page.getByLabel('Nombre').fill('Teclado');
  await page.keyboard.press('Enter'); // Enter in a text field submits the form.
  await expect(page.getByRole('listitem').filter({ hasText: 'Teclado' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('profile texts follow the language', async ({ page }) => {
  await open(page, 'en');
  await page.getByRole('button', { name: /^Profiles:/ }).click();
  await expect(page.getByRole('heading', { name: 'Check profiles' })).toBeVisible();
  await expect(page.getByText('Automatic: the AI proposes')).toBeVisible();
});
