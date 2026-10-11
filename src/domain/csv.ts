/**
 * CSV seguro: separador coma, decimales con punto, fechas ISO 8601 con desfase.
 * Los textos que empiezan como fórmula (=, +, -, @, tabulación, retorno) se neutralizan
 * anteponiendo un apóstrofo para que una hoja de cálculo no los ejecute.
 */

export type CsvCell = string | number | boolean | null | undefined;

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  let s = value;
  if (FORMULA_START.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(header: string[], rows: CsvCell[][]): string {
  const lines = [header.map(csvCell).join(','), ...rows.map((r) => r.map(csvCell).join(','))];
  // BOM para que las hojas de cálculo detecten UTF-8 (tildes y ñ).
  return '﻿' + lines.join('\r\n') + '\r\n';
}
