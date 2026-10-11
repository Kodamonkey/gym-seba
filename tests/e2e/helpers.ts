import { expect, type Page } from '@playwright/test';

/** Completa la configuración inicial con los valores precargados y una medición de peso. */
export async function onboard(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Bienvenido a ATLAS' })).toBeVisible();
  await page.getByLabel('Peso', { exact: true }).fill('82');
  await page.getByRole('button', { name: 'Crear programa y empezar' }).click();
  await expect(page.getByRole('heading', { name: 'Hoy', exact: true })).toBeVisible();
}

/** Inicia una sesión libre de un día de la rutina. */
export async function startFree(page: Page, day = 'Tren superior A') {
  await page.getByLabel('Día de la rutina').selectOption({ label: day });
  await page.getByRole('button', { name: /Iniciar sesión libre/ }).click();
  await expect(page).toHaveURL(/\/sesion$/);
}

/** Pausa breve como la de una persona (el teclado móvil y el ajuste de scroll tardan ~300 ms). */
export const humanPause = (page: Page) => page.waitForTimeout(450);

export async function logSet(page: Page, index: number, load: string, reps: string, rir?: string) {
  await page.getByLabel(/^Carga/).nth(index).fill(load);
  await page.getByLabel('Repeticiones').nth(index).fill(reps);
  if (rir !== undefined) await page.getByLabel('RIR (opcional)').nth(index).fill(rir);
  await humanPause(page);
  await page.getByRole('button', { name: 'Confirmar serie' }).first().click();
  await expect(page.getByRole('button', { name: 'Serie confirmada. Tocar para corregir' })).toHaveCount(index + 1);
}
