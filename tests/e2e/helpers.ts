import { expect, type Page } from '@playwright/test';

/** Pausa breve como la de una persona (el teclado móvil y el ajuste de scroll tardan ~300 ms). */
export const humanPause = (page: Page) => page.waitForTimeout(450);

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Bloque de un ejercicio en la sesión (sección nombrada por su título). */
export const exercise = (page: Page, name = 'Press de pecho en máquina') => page.getByRole('region', { name: new RegExp(escape(name)) });

/** Abre un día y empieza; las pruebas de alternativas preparan el Día 2 completando el primero. */
export async function startDay(page: Page, dayId = 'day-upper-a') {
  if (dayId === 'day-lower-a') {
    await startDay(page);
    await completeDay(page);
  }
  await page.goto(`/dia/${dayId}`);
  await page.getByRole('button', { name: 'Empezar', exact: true }).click();
  await expect(page).toHaveURL(/\/sesion$/);
}

/** Completa las series prescritas mediante la interfaz, sin fabricar registros en IndexedDB. */
export async function completeDay(page: Page) {
  const blocks = page.getByRole('region').filter({ has: page.getByLabel(/^Carga serie /) });
  await expect(blocks.first()).toBeVisible();
  for (let i = 0; i < await blocks.count(); i++) {
    const block = blocks.nth(i);
    const loads = block.getByLabel(/^Carga serie /);
    const amounts = block.getByLabel(/^(Repeticiones|Segundos)( por lado)? serie /);
    for (let j = 0; j < await loads.count(); j++) {
      await loads.nth(j).fill('10');
      await amounts.nth(j).fill('10');
      await humanPause(page);
      const n = j + 1;
      await block.getByRole('button', { name: `Marcar serie ${n} como hecha`, exact: true }).click();
      await expect(block.getByRole('button', { name: `Serie ${n} hecha. Tocar para corregir`, exact: true })).toBeVisible();
      const rest = page.getByRole('region', { name: 'Descanso', exact: true });
      await expect(rest).toBeVisible();
      await rest.getByRole('button', { name: 'Saltar', exact: true }).click();
      await rest.getByRole('button', { name: 'Cerrar', exact: true }).click();
      await expect(rest).not.toBeVisible();
    }
  }
  await page.getByRole('button', { name: 'Terminar', exact: true }).click();
  const finish = page.getByRole('dialog', { name: 'Terminar entrenamiento', exact: true });
  await expect(finish.getByText('Al guardar, verás el próximo día pendiente.', { exact: true })).toBeVisible();
  await finish.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mi rutina', exact: true })).toBeVisible();
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
