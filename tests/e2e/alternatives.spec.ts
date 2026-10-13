import { expect, test } from '@playwright/test';
import { exercise, humanPause, logSet, startDay } from './helpers';

test('cambiar una máquina ausente conserva lo realizado y explica otro movimiento a 320 px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await startDay(page, 'day-lower-a');
  const originalName = 'Extensión de cuádriceps en máquina';
  const original = exercise(page, originalName);
  await logSet(page, 0, '25', '12', originalName);
  await original.getByRole('button', { name: `Cambiar ${originalName}`, exact: true }).click();

  const selector = page.getByRole('dialog', { name: 'Cambiar por', exact: true });
  await expect(selector).toBeVisible();
  const goblet = selector.getByRole('button', { name: /^Sentadilla goblet/ });
  await expect(goblet).toContainText('Mancuernas · Otro movimiento');
  await expect(selector.getByText(/aislamiento/)).toBeVisible();
  await expect.poll(() => selector.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  const targetSize = await goblet.evaluate((element) => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }));
  expect(targetSize.width).toBeGreaterThanOrEqual(44);
  expect(targetSize.height).toBeGreaterThanOrEqual(44);
  await goblet.click();
  await expect(selector).not.toBeVisible();

  const replacement = exercise(page, 'Sentadilla goblet');
  await expect(original.getByLabel('Carga serie 1', { exact: true })).toHaveValue('25');
  await expect(original.getByLabel('Repeticiones serie 1', { exact: true })).toHaveValue('12');
  await expect(original.getByRole('button', { name: 'Serie 1 hecha. Tocar para corregir', exact: true })).toBeVisible();
  await expect(original.getByLabel('Carga serie 1', { exact: true })).toBeDisabled();
  await expect(original.getByLabel('Carga serie 2', { exact: true })).toHaveCount(0);
  await expect(replacement.getByLabel('Carga serie 1', { exact: true })).toHaveValue('');
  await expect(replacement.getByLabel('Carga serie 1', { exact: true })).toHaveAttribute('placeholder', '');
  await expect(replacement.getByLabel('Repeticiones serie 1', { exact: true })).toHaveValue('');
  await replacement.getByRole('button', { name: 'Ver técnica de Sentadilla goblet', exact: true }).click();
  const technique = page.getByRole('dialog', { name: 'Sentadilla goblet', exact: true });
  await expect(technique.getByRole('img', { name: /Demostración: Sentadilla goblet/ })).toBeVisible();
  await expect(technique.getByText(/Sostén una mancuerna vertical/)).toBeVisible();
  await technique.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.reload();
  await expect(original.getByLabel('Carga serie 1', { exact: true })).toHaveValue('25');
  await expect(replacement.getByLabel('Carga serie 1', { exact: true })).toHaveValue('');
});

test('Pallof isométrico registra segundos por lado al sustituir la variante por repeticiones', async ({ page }) => {
  await startDay(page, 'day-lower-a');
  await exercise(page, 'Pallof press en polea').getByRole('button', { name: 'Cambiar Pallof press en polea', exact: true }).click();
  await page.getByRole('dialog', { name: 'Cambiar por', exact: true }).getByRole('button', { name: /^Pallof con mantenimiento isométrico/ }).click();
  const hold = exercise(page, 'Pallof con mantenimiento isométrico');
  await expect(hold.getByText('2 × 20–30 s por lado', { exact: false })).toBeVisible();
  await hold.getByLabel('Carga serie 1', { exact: true }).fill('5');
  await hold.getByLabel('Segundos por lado serie 1', { exact: true }).fill('25');
  await humanPause(page);
  await hold.getByRole('button', { name: 'Marcar serie 1 como hecha', exact: true }).click();
  await expect(hold.getByRole('button', { name: 'Serie 1 hecha. Tocar para corregir', exact: true })).toBeVisible();
  await page.reload();
  await expect(hold.getByLabel('Segundos por lado serie 1', { exact: true })).toHaveValue('25');
  await expect(hold.getByLabel('Repeticiones por lado serie 1', { exact: true })).toHaveCount(0);
});

test('cambiar laterales entre mancuernas y polea adapta el registro por lado y limpia borradores', async ({ page }) => {
  await startDay(page);
  const dumbbellName = 'Elevaciones laterales con mancuernas';
  const cableName = 'Elevación lateral en polea (unilateral)';
  const dumbbell = exercise(page, dumbbellName);
  await dumbbell.getByLabel('Carga serie 1', { exact: true }).fill('7');
  await dumbbell.getByLabel('Repeticiones serie 1', { exact: true }).fill('13');
  await humanPause(page);
  await dumbbell.getByRole('button', { name: `Cambiar ${dumbbellName}`, exact: true }).click();
  const selector = page.getByRole('dialog', { name: 'Cambiar por', exact: true });
  const cableOption = selector.getByRole('button', { name: /^Elevación lateral en polea/ });
  await expect(cableOption).toContainText('Polea · Mismo ejercicio');
  await cableOption.click();

  const cable = exercise(page, cableName);
  await expect(cable.getByLabel('Repeticiones por lado serie 1', { exact: true })).toBeVisible();
  await expect(cable.getByLabel('Carga serie 1', { exact: true })).toHaveValue('');
  await expect(cable.getByLabel('Carga serie 1', { exact: true })).toHaveAttribute('placeholder', '');
  await expect(cable.getByLabel('Repeticiones por lado serie 1', { exact: true })).toHaveValue('');
  await cable.getByLabel('Carga serie 1', { exact: true }).fill('5');
  await cable.getByLabel('Repeticiones por lado serie 1', { exact: true }).fill('12');
  await humanPause(page);
  await cable.getByRole('button', { name: `Cambiar ${cableName}`, exact: true }).click();
  const dumbbellOption = selector.getByRole('button', { name: /^Elevaciones laterales con mancuernas/ });
  await expect(dumbbellOption).toContainText('Mancuernas · Mismo ejercicio');
  await dumbbellOption.click();

  await expect(dumbbell.getByLabel('Repeticiones serie 1', { exact: true })).toBeVisible();
  await expect(dumbbell.getByLabel('Repeticiones por lado serie 1', { exact: true })).toHaveCount(0);
  await expect(dumbbell.getByLabel('Carga serie 1', { exact: true })).toHaveValue('');
  await expect(dumbbell.getByLabel('Carga serie 1', { exact: true })).toHaveAttribute('placeholder', '');
  await expect(dumbbell.getByLabel('Repeticiones serie 1', { exact: true })).toHaveValue('');
});
