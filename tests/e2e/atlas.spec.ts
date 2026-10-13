import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { completeDay, exercise, humanPause, logSet, startDay } from './helpers';

test('el inicio muestra los días de la rutina sin configuración inicial', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Mi rutina' })).toBeVisible();
  for (const day of ['Tren superior A', 'Tren inferior A', 'Tren superior B', 'Tren inferior B']) {
    await expect(page.getByRole('link', { name: new RegExp(day) }).first()).toBeVisible();
  }
});

test('creada un domingo, ofrece el Día 1 y no salta por faltar a entrenar', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-11T15:00:00-03:00') });
  await page.goto('/');
  await expect(page.getByText('Siguiente entrenamiento', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /Día 1.*Tren superior A/ }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Empezar', exact: true })).toBeVisible();
  await page.clock.setSystemTime(new Date('2026-10-20T15:00:00-03:00'));
  await page.reload();
  await expect(page.getByRole('link', { name: /Día 1.*Tren superior A/ }).first()).toBeVisible();
  await expect(page.getByText(/^0 entrenamientos completos(?: · adaptación)?$/)).toBeVisible();
  await expect(page.getByText('Descanso', { exact: true })).toHaveCount(0);
});

test('registro una serie, recargo y recupero los datos y el descanso', async ({ page }) => {
  await startDay(page);
  await logSet(page, 0, '42,5', '10');
  await expect(page.getByRole('region', { name: 'Descanso' })).toBeVisible();
  await page.reload();
  const ex = exercise(page);
  await expect(ex.getByLabel('Carga serie 1', { exact: true })).toHaveValue('42,5');
  await expect(ex.getByLabel('Repeticiones serie 1', { exact: true })).toHaveValue('10');
  await expect(ex.getByRole('button', { name: 'Serie 1 hecha. Tocar para corregir' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Descanso' })).toBeVisible();
});

test('con los campos vacíos, el check repite la serie anterior; sin nada que repetir, pide los datos', async ({ page }) => {
  await startDay(page);
  const ex = exercise(page);
  await ex.getByRole('button', { name: 'Marcar serie 1 como hecha' }).click();
  await expect(ex.getByText('Escribe kg y reps (0 si no usas peso).')).toBeVisible();
  await logSet(page, 0, '40', '10');
  await ex.getByRole('button', { name: 'Marcar serie 2 como hecha' }).click();
  await expect(ex.getByRole('button', { name: 'Serie 2 hecha. Tocar para corregir' })).toBeVisible();
  await expect(ex.getByLabel('Carga serie 2', { exact: true })).toHaveValue('40');
  await expect(ex.getByLabel('Repeticiones serie 2', { exact: true })).toHaveValue('10');
});

test('se rechazan valores inválidos', async ({ page }) => {
  await startDay(page);
  const ex = exercise(page);
  await ex.getByLabel('Carga serie 1', { exact: true }).fill('-5');
  await ex.getByLabel('Repeticiones serie 1', { exact: true }).fill('10');
  await humanPause(page);
  await ex.getByRole('button', { name: 'Marcar serie 1 como hecha' }).click();
  await expect(ex.getByText('La carga no puede ser negativo.')).toBeVisible();
  await expect(ex.getByRole('button', { name: 'Marcar serie 1 como hecha' })).toBeVisible();
});

test('los borradores no cuentan; terminar guarda como parcial y queda en el historial', async ({ page }) => {
  await startDay(page);
  const ex = exercise(page);
  await ex.getByLabel('Carga serie 1', { exact: true }).fill('50');
  await ex.getByLabel('Repeticiones serie 1', { exact: true }).click(); // guarda el borrador
  await page.getByRole('button', { name: 'Terminar', exact: true }).click();
  await expect(page.getByText('Aún no marcaste ninguna serie.')).toBeVisible();
  await page.getByRole('button', { name: 'Seguir entrenando' }).click();
  await logSet(page, 0, '50', '8');
  await page.getByRole('button', { name: 'Terminar', exact: true }).click();
  await expect(page.getByText(/^Se guardará como parcial en tu historial\./)).toBeVisible();
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mi rutina' })).toBeVisible();
  await expect(page.getByText(/^0 entrenamientos completos(?: · adaptación)?$/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Día 1.*Tren superior A/ }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: /Día 1.*Tren superior A/ }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Ver todo' }).click();
  await page.getByRole('link', { name: /Tren superior A/ }).click();
  await expect(page.getByText('50 × 8')).toBeVisible();
});

test('completar el Día 1 avanza al Día 2; recargar y guardar una parcial sin conexión conserva el turno', async ({ page, context }) => {
  test.slow();
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await page.goto('/dia/day-lower-a');
  await expect(page.getByText(/^Completa el Día 1 para avanzar\.?$/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Empezar', exact: true })).toHaveCount(0);
  await startDay(page);
  await completeDay(page);
  await expect(page.getByText(/^1 entrenamiento completo(?: · adaptación)?$/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Día 2.*Tren inferior A/ }).first()).toBeVisible();

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('link', { name: /Día 2.*Tren inferior A/ }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Empezar', exact: true }).click();
  await expect(page).toHaveURL(/\/sesion$/);
  await logSet(page, 0, '40', '10', 'Prensa de piernas');
  await page.getByRole('button', { name: 'Terminar', exact: true }).click();
  await page.getByRole('dialog', { name: 'Terminar entrenamiento', exact: true }).getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mi rutina', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(/^1 entrenamiento completo(?: · adaptación)?$/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Día 2.*Tren inferior A/ }).first()).toBeVisible();
  await context.setOffline(false);
});

test('dos pestañas: una edita, la otra queda en solo lectura y puede tomar el control', async ({ page, context }) => {
  await startDay(page);
  const other = await context.newPage();
  await other.goto('/sesion');
  await expect(other.getByText('Este entrenamiento está abierto en otra pestaña')).toBeVisible();
  await expect(exercise(other).getByRole('button', { name: 'Marcar serie 1 como hecha' })).toBeDisabled();
  await other.getByRole('button', { name: 'Usar aquí' }).click();
  await expect(exercise(other).getByRole('button', { name: 'Marcar serie 1 como hecha' })).toBeEnabled();
  await expect(page.getByText('Este entrenamiento está abierto en otra pestaña')).toBeVisible();
  await logSet(other, 0, '40', '10');
  await expect(exercise(page).getByLabel('Carga serie 1', { exact: true })).toHaveValue('40');
});

test('cambiar un ejercicio actualiza su técnica y demostración', async ({ page }) => {
  await startDay(page);
  await page.getByRole('button', { name: 'Opciones de Press de pecho en máquina' }).click();
  await page.getByRole('button', { name: 'Cambiar ejercicio' }).click();
  await page.getByRole('button', { name: 'Press de pecho con mancuernas' }).click();
  await expect(page.getByRole('heading', { name: /Press de pecho con mancuernas/ })).toBeVisible();
  await page.getByRole('button', { name: 'Opciones de Press de pecho con mancuernas' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Ver técnica', exact: true }).click();
  await expect(page.getByText(/Acostado en banco plano/)).toBeVisible();
  await expect(page.getByRole('img', { name: /Demostración: Press de pecho con mancuernas/ })).toBeVisible();
});

test('con movimiento reducido la demostración muestra inicio y fin sin animar', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto('/dia/day-upper-a');
  await page.getByRole('button', { name: 'Press de pecho en máquina: ver técnica' }).click();
  await expect(page.getByText('Final del recorrido')).toBeVisible();
  await ctx.close();
});

test('la recarga en una ruta profunda funciona', async ({ page }) => {
  await page.goto('/historial');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Historial' })).toBeVisible();
  await page.goto('/dia/day-lower-b');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Tren inferior B' })).toBeVisible();
});

test('un archivo de importación inválido no modifica la base', async ({ page }) => {
  await startDay(page);
  await logSet(page, 0, '40', '10');
  await page.goto('/ajustes');
  await page.getByLabel('Archivo de respaldo').setInputFiles({ name: 'malo.json', mimeType: 'application/json', buffer: Buffer.from('{"app":"atlas","schemaVersion":1}') });
  await expect(page.getByText(/El archivo no se importó/)).toBeVisible();
  await page.goto('/sesion');
  await expect(exercise(page).getByLabel('Carga serie 1', { exact: true })).toHaveValue('40');
});

test('exportar e importar el propio respaldo no duplica datos', async ({ page }) => {
  await startDay(page);
  await logSet(page, 0, '40', '10');
  await page.goto('/ajustes');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar respaldo' }).click();
  const file = await (await download).path();
  await page.getByLabel('Archivo de respaldo').setInputFiles(file);
  await expect(page.getByText(/: 0 registros nuevos, \d+ iguales y 0 distintos/)).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Importar', exact: true }).click();
  await expect(page.getByText('Importación completa: 0 registros.')).toBeVisible();
  await page.goto('/sesion');
  await expect(exercise(page).getByLabel('Carga serie 1', { exact: true })).toHaveValue('40');
  await expect(exercise(page).getByRole('button', { name: 'Serie 1 hecha. Tocar para corregir' })).toHaveCount(1);
});

test('los CSV se descargan por separado con los registros reales', async ({ page }) => {
  await startDay(page);
  await logSet(page, 0, '42,5', '10');
  await page.goto('/ajustes');
  await page.getByText('Exportar para una hoja de cálculo', { exact: true }).click();
  const setsDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar series (CSV)', exact: true }).click();
  const setsFile = await (await setsDownload).path();
  const sets = await readFile(setsFile!, 'utf8');
  expect(sets).toContain('carga');
  expect(sets).toContain('Press de pecho en máquina');
  expect(sets).toContain('42.5');
  const sessionsDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar sesiones (CSV)', exact: true }).click();
  const sessionsFile = await (await sessionsDownload).path();
  const sessions = await readFile(sessionsFile!, 'utf8');
  expect(sessions).toContain('America/Santiago');
  expect(sessions).toContain('Tren superior A');
});

test('se puede seguir registrando sin conexión tras preparar la app', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Mi rutina' })).toBeVisible();
  await startDay(page);
  await logSet(page, 0, '40', '10');
  await context.setOffline(false);
});
