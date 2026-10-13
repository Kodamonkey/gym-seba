import { expect, type Page } from '@playwright/test';

/** Pausa breve como la de una persona (el teclado móvil y el ajuste de scroll tardan ~300 ms). */
export const humanPause = (page: Page) => page.waitForTimeout(450);

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Bloque de un ejercicio en la sesión (sección nombrada por su título). */
export const exercise = (page: Page, name = 'Press de pecho en máquina') => page.getByRole('region', { name: new RegExp(escape(name)) });

/** Abre un día de la rutina y empieza el entrenamiento. */
export async function startDay(page: Page, dayId = 'day-upper-a') {
  await page.goto(`/dia/${dayId}`);
  await page.getByRole('button', { name: 'Empezar', exact: true }).click();
  await expect(page).toHaveURL(/\/sesion$/);
}

export async function logSet(page: Page, index: number, load: string, reps: string, name?: string) {
  const ex = exercise(page, name);
  const n = index + 1;
  await ex.getByLabel(`Carga serie ${n}`, { exact: true }).fill(load);
  await ex.getByLabel(`Repeticiones serie ${n}`, { exact: true }).fill(reps);
  await humanPause(page);
  await ex.getByRole('button', { name: `Marcar serie ${n} como hecha` }).click();
  await expect(ex.getByRole('button', { name: `Serie ${n} hecha. Tocar para corregir` })).toBeVisible();
}
