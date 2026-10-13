import { expect, test, type Locator, type Page } from '@playwright/test';
import { exercise, humanPause, logSet, startDay } from './helpers';

async function withoutHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible()) {
    await expect.poll(() => dialog.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  }
}

async function touchTarget(target: Locator) {
  await expect(target).toBeVisible();
  const size = await target.evaluate((element) => {
    // El interruptor usa toda su etiqueta como área táctil, además del indicador visual.
    const area = element.getAttribute('role') === 'switch' ? (element.closest('label') ?? element) : element;
    const rect = area.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });
  // La resta de coordenadas del navegador puede devolver 43.999992 px para un control de 44 px.
  expect(Math.round(size.width * 100) / 100).toBeGreaterThanOrEqual(44);
  expect(Math.round(size.height * 100) / 100).toBeGreaterThanOrEqual(44);
}

for (const width of [320, 375, 390]) {
  test(`flujo móvil a ${width}px: sin desborde, controles amplios y técnica a un toque`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.clock.install({ time: new Date('2026-10-12T10:00:00-03:00') });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Mi rutina' })).toBeVisible();
    await withoutHorizontalOverflow(page);
    await touchTarget(page.getByRole('link', { name: 'Ajustes', exact: true }));
    await touchTarget(page.getByRole('link', { name: /Tren superior A/ }).last());
    await touchTarget(page.getByRole('button', { name: 'Empezar', exact: true }));

    await page.getByRole('link', { name: /Tren superior A/ }).last().click();
    await expect(page.getByRole('heading', { name: 'Tren superior A', exact: true })).toBeVisible();
    await withoutHorizontalOverflow(page);
    await touchTarget(page.getByRole('link', { name: 'Volver', exact: true }));
    await touchTarget(page.getByRole('button', { name: 'Press de pecho en máquina: ver técnica', exact: true }));
    await touchTarget(page.getByRole('button', { name: 'Empezar', exact: true }));
    await page.getByRole('button', { name: 'Empezar', exact: true }).click();
    await expect(page).toHaveURL(/\/sesion$/);

    const ex = exercise(page);
    await expect(ex.getByRole('button', { name: 'Marcar serie 1 como hecha', exact: true })).toBeEnabled();
    await withoutHorizontalOverflow(page);
    await touchTarget(page.getByRole('button', { name: 'Terminar', exact: true }));
    await touchTarget(ex.getByLabel('Carga serie 1', { exact: true }));
    await touchTarget(ex.getByLabel('Repeticiones serie 1', { exact: true }));
    await touchTarget(ex.getByRole('button', { name: 'Marcar serie 1 como hecha', exact: true }));
    await touchTarget(ex.getByRole('button', { name: 'Opciones de Press de pecho en máquina', exact: true }));
    const technique = ex.getByRole('button', { name: 'Ver técnica de Press de pecho en máquina', exact: true });
    await touchTarget(technique);
    await technique.click();
    const dialog = page.getByRole('dialog', { name: 'Press de pecho en máquina', exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('img', { name: /Demostración: Press de pecho en máquina/ })).toBeVisible();
    await withoutHorizontalOverflow(page);
    await touchTarget(dialog.getByRole('button', { name: 'Cerrar', exact: true }));
    await touchTarget(dialog.getByRole('button', { name: /Reproducir/ }));
    await touchTarget(dialog.getByRole('button', { name: 'Reiniciar demostración', exact: true }));
    await touchTarget(dialog.getByRole('slider', { name: 'Posición dentro del movimiento', exact: true }));
    await touchTarget(dialog.getByRole('combobox', { name: 'Velocidad de reproducción', exact: true }));
    await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(technique).toBeFocused();

    await page.goto('/ajustes');
    await expect(page.getByRole('heading', { name: 'Ajustes', exact: true })).toBeVisible();
    await withoutHorizontalOverflow(page);
    await touchTarget(page.getByRole('button', { name: 'Exportar respaldo', exact: true }));
    await touchTarget(page.getByRole('button', { name: 'Importar respaldo', exact: true }));
    await touchTarget(page.getByRole('switch', { name: 'Iniciar descanso al marcar una serie', exact: true }));
  });
}

test('el descanso pausado conserva el tiempo al recargar y puede reanudarse', async ({ page }) => {
  await startDay(page);
  await logSet(page, 0, '40', '10');
  const rest = page.getByRole('region', { name: 'Descanso', exact: true });
  await expect(rest).toBeVisible();
  await touchTarget(rest.getByRole('button', { name: 'Pausar descanso', exact: true }));
  await touchTarget(rest.getByRole('button', { name: 'Restar 15 segundos', exact: true }));
  await touchTarget(rest.getByRole('button', { name: 'Sumar 15 segundos', exact: true }));
  await touchTarget(rest.getByRole('button', { name: 'Saltar', exact: true }));
  await rest.getByRole('button', { name: 'Pausar descanso', exact: true }).click();
  await expect(rest.getByText('En pausa', { exact: true })).toBeVisible();
  const time = rest.getByText(/^\d+:\d{2}$/);
  const paused = await time.innerText();
  await page.reload();
  await expect(rest.getByText('En pausa', { exact: true })).toBeVisible();
  await expect(time).toHaveText(paused);
  await page.waitForTimeout(1200);
  await expect(time).toHaveText(paused);
  await rest.getByRole('button', { name: 'Reanudar descanso', exact: true }).click();
  await expect(rest.getByRole('button', { name: 'Pausar descanso', exact: true })).toBeVisible();
  await expect.poll(() => time.innerText()).not.toBe(paused);
});

test('el borrador se guarda con el campo enfocado y sobrevive a una recarga', async ({ page }) => {
  await startDay(page);
  const ex = exercise(page);
  const load = ex.getByLabel('Carga serie 1', { exact: true });
  const reps = ex.getByLabel('Repeticiones serie 1', { exact: true });
  await load.fill('42,5');
  await reps.fill('11');
  await expect(reps).toBeFocused();
  await humanPause(page);
  await page.reload();
  await expect(load).toHaveValue('42,5');
  await expect(reps).toHaveValue('11');
  await expect(ex.getByRole('button', { name: 'Marcar serie 1 como hecha', exact: true })).toBeVisible();
  await expect(ex.getByRole('button', { name: 'Serie 1 hecha. Tocar para corregir', exact: true })).toHaveCount(0);
});

test('ocho semanas sin entrenar mantienen el Día 1 y no inventan un programa completado', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-12T10:00:00-03:00') });
  await page.goto('/');
  await expect(page.getByRole('link', { name: /Día 1.*Tren superior A/ }).first()).toBeVisible();
  await page.clock.setSystemTime(new Date('2026-12-07T10:00:00-03:00'));
  await page.reload();
  await expect(page.getByRole('link', { name: /Día 1.*Tren superior A/ }).first()).toBeVisible();
  await expect(page.getByText(/^0 entrenamientos completos(?: · adaptación)?$/)).toBeVisible();
  await expect(page.getByText('Período de 8 semanas finalizado', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Semana 8 de 8', { exact: false })).toHaveCount(0);
  await expect(page.getByText('Programa completado', { exact: false })).toHaveCount(0);
  await expect(page.getByText('Objetivo logrado', { exact: false })).toHaveCount(0);
});
