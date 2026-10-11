import { expect, test } from '@playwright/test';
import { humanPause, logSet, onboard, startFree } from './helpers';

test('registro una serie, recargo y recupero exactamente los datos y el descanso', async ({ page }) => {
  await onboard(page);
  await startFree(page);
  await logSet(page, 0, '42,5', '10', '2');
  await expect(page.getByRole('region', { name: 'Temporizador de descanso' })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel(/^Carga/).first()).toHaveValue('42,5');
  await expect(page.getByLabel('Repeticiones').first()).toHaveValue('10');
  await expect(page.getByLabel('RIR (opcional)').first()).toHaveValue('2');
  await expect(page.getByRole('button', { name: 'Serie confirmada. Tocar para corregir' }).first()).toBeVisible();
  await expect(page.getByRole('region', { name: 'Temporizador de descanso' })).toBeVisible();
});

test('los valores sugeridos y los borradores no cuentan como realizados', async ({ page }) => {
  await onboard(page);
  await startFree(page);
  await page.getByLabel(/^Carga/).first().fill('50');
  await page.getByLabel('Repeticiones').first().click(); // dispara el guardado del borrador
  await page.getByRole('button', { name: 'Finalizar', exact: true }).click();
  await expect(page.getByText(/Series de trabajo confirmadas: 0 de/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Finalizar como completada' })).toBeDisabled();
});

test('campo vacío no es cero y se rechazan valores inválidos', async ({ page }) => {
  await onboard(page);
  await startFree(page);
  await page.getByLabel('Repeticiones').first().fill('10');
  await humanPause(page);
  await page.getByRole('button', { name: 'Confirmar serie' }).first().click();
  await expect(page.getByText('Indica la carga (puede ser 0 si no usas carga externa).')).toBeVisible();
  await page.getByLabel(/^Carga/).first().fill('-5');
  await humanPause(page);
  await page.getByRole('button', { name: 'Confirmar serie' }).first().click();
  await expect(page.getByText('La carga no puede ser negativo.')).toBeVisible();
  await page.getByLabel(/^Carga/).first().fill('0');
  await humanPause(page);
  await page.getByRole('button', { name: 'Confirmar serie' }).first().click();
  await expect(page.getByText('Carga externa 0 registrada explícitamente')).toBeVisible();
});

test('dos pestañas: una edita, la otra queda en solo lectura y puede tomar el control', async ({ page, context }) => {
  await onboard(page);
  await startFree(page);
  const other = await context.newPage();
  await other.goto('/sesion');
  await expect(other.getByText('Esta sesión se está editando en otra pestaña')).toBeVisible();
  await expect(other.getByRole('button', { name: 'Confirmar serie' }).first()).toBeDisabled();
  await other.getByRole('button', { name: 'Tomar el control aquí' }).click();
  await expect(other.getByRole('button', { name: 'Confirmar serie' }).first()).toBeEnabled();
  await expect(page.getByText('Esta sesión se está editando en otra pestaña')).toBeVisible();
  await logSet(other, 0, '40', '10');
  await expect(page.getByLabel(/^Carga/).first()).toHaveValue('40');
});

test('cambiar de variante actualiza demostración, músculos y técnica', async ({ page }) => {
  await onboard(page);
  await startFree(page);
  await expect(page.getByRole('heading', { name: 'Press de pecho en máquina' })).toBeVisible();
  await expect(page.getByText(/Ajusta el asiento para que los agarres/)).toBeVisible();
  await page.getByRole('button', { name: 'Sustituir' }).click();
  await page.getByRole('button', { name: 'Press de pecho con mancuernas' }).click();
  await expect(page.getByRole('heading', { name: 'Press de pecho con mancuernas' })).toBeVisible();
  await expect(page.getByText(/Acostado en banco plano/)).toBeVisible();
  await expect(page.getByText(/Ajusta el asiento para que los agarres/)).toHaveCount(0);
  await expect(page.getByRole('img', { name: /Demostración: Press de pecho con mancuernas/ })).toBeVisible();
  await expect(page.getByText('Antebrazo (agarre)')).toBeVisible();
});

test('un recurso ausente se identifica sin sustituirlo por otro movimiento', async ({ page }) => {
  await onboard(page);
  await page.goto('/rutina?tab=biblioteca');
  await page.getByRole('button', { name: '+ Crear variante propia' }).click();
  await page.getByLabel('Nombre de la variante').fill('Extensión de cuádriceps, máquina 2');
  await page.getByLabel('Ejercicio', { exact: true }).selectOption({ label: 'Extensión de cuádriceps' });
  await page.getByRole('button', { name: 'Crear', exact: true }).click();
  await expect(page.getByText('Demostración no disponible para esta variante')).toBeVisible();
  await expect(page.getByRole('img', { name: /^Demostración:/ })).toHaveCount(0);
});

test('con movimiento reducido la demostración muestra inicio y fin sin animar', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await onboard(page);
  await startFree(page);
  await expect(page.getByText('Final del recorrido')).toBeVisible();
  await ctx.close();
});

test('la recarga en una ruta profunda funciona', async ({ page }) => {
  await onboard(page);
  await page.goto('/progreso');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Progreso' })).toBeVisible();
  await page.goto('/biblioteca/v-leg-press');
  await expect(page.getByRole('heading', { name: 'Prensa de piernas 45°' })).toBeVisible();
});

test('un archivo de importación inválido no modifica la base', async ({ page }) => {
  await onboard(page);
  await startFree(page);
  await logSet(page, 0, '40', '10');
  await page.goto('/ajustes');
  await page.getByLabel('Importar respaldo').setInputFiles({ name: 'malo.json', mimeType: 'application/json', buffer: Buffer.from('{"app":"atlas","schemaVersion":1}') });
  await expect(page.getByText('El archivo no se importó (la base no se modificó):')).toBeVisible();
  await page.goto('/sesion');
  await expect(page.getByLabel(/^Carga/).first()).toHaveValue('40');
});

test('exportar e importar el propio respaldo no duplica datos', async ({ page }) => {
  await onboard(page);
  await startFree(page);
  await logSet(page, 0, '40', '10');
  await page.goto('/ajustes');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar respaldo (JSON)' }).click();
  const file = await (await download).path();
  await page.getByLabel('Importar respaldo').setInputFiles(file);
  await expect(page.getByText(/0 nuevos, \d+ idénticos, 0 con el mismo id/)).toBeVisible();
});

test('se puede seguir registrando sin conexión tras preparar la app', async ({ page, context }) => {
  await onboard(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hoy', exact: true })).toBeVisible();
  await expect(page.getByText(/Sin conexión/)).toBeVisible();
  await startFree(page);
  await logSet(page, 0, '40', '10');
  await expect(page.getByRole('img', { name: /Demostración: Press de pecho en máquina/ })).toBeVisible();
  await context.setOffline(false);
});

test('el calendario no marca como completada una sesión pasada sin registro', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-20T15:00:00Z') });
  await page.goto('/');
  await page.getByLabel('Peso', { exact: true }).fill('82');
  await page.getByLabel('Fecha de inicio del programa').fill('2026-10-12');
  await page.getByRole('button', { name: 'Crear programa y empezar' }).click();
  await expect(page.getByText('Sesiones pasadas sin registrar')).toBeVisible();
  await page.goto('/calendario');
  await page.getByRole('button', { name: 'Agenda' }).click();
  await expect(page.getByRole('button', { name: /Sin registrar, lunes 12 oct/ })).toBeVisible();
});
