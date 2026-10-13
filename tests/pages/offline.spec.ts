import { expect, test } from '@playwright/test';
import { logSet } from '../e2e/helpers';

test('guardar y volver al inicio conservan la barra final, el alcance PWA y los registros offline en Pages', async ({ page, context, baseURL }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Mi rutina', exact: true })).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  expect(await page.evaluate(async () => (await navigator.serviceWorker.ready).scope)).toBe(baseURL);

  await page.getByRole('link', { name: /Día 1.*Tren superior A/ }).first().click();
  await expect(page).toHaveURL(`${baseURL}dia/day-upper-a`);
  await page.getByRole('button', { name: 'Empezar', exact: true }).click();
  await expect(page).toHaveURL(`${baseURL}sesion`);
  await logSet(page, 0, '42,5', '10');
  await page.getByRole('button', { name: 'Terminar', exact: true }).click();
  await page.getByRole('dialog', { name: 'Terminar entrenamiento', exact: true }).getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mi rutina', exact: true })).toBeVisible();
  await expect(page).toHaveURL(baseURL!);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Mi rutina', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /Día 1.*Tren superior A/ }).first()).toBeVisible();
  await expect(page.getByText(/^0 entrenamientos completos(?: · adaptación)?$/)).toBeVisible();
  await page.getByRole('link', { name: 'Ver todo', exact: true }).click();
  await page.getByRole('link', { name: /Tren superior A/ }).click();
  await expect(page.getByText('42,5 × 10', { exact: true })).toBeVisible();

  await page.goto('./dia/day-upper-a');
  const back = page.getByRole('link', { name: 'Volver', exact: true });
  await expect(back).toHaveAttribute('href', '/gym-seba/');
  await back.click();
  await expect(page).toHaveURL(baseURL!);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Mi rutina', exact: true })).toBeVisible();
  await context.setOffline(false);
});
