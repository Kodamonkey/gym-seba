import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from './csv';

describe('CSV', () => {
  it('escapa comillas, comas y saltos de línea', () => {
    expect(csvCell('asiento 4, respaldo 2')).toBe('"asiento 4, respaldo 2"');
    expect(csvCell('dijo "ok"')).toBe('"dijo ""ok"""');
    expect(csvCell('a\nb')).toBe('"a\nb"');
  });

  it('neutraliza fórmulas en textos', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('-2')).toBe("'-2");
    expect(csvCell('@cmd')).toBe("'@cmd");
  });

  it('mantiene números con punto decimal y vacíos como vacío', () => {
    expect(csvCell(12.5)).toBe('12.5');
    expect(csvCell(0)).toBe('0');
    expect(csvCell(null)).toBe('');
  });

  it('genera cabecera y filas', () => {
    const out = toCsv(['a', 'b'], [[1, 'x']]);
    expect(out).toBe('﻿a,b\r\n1,x\r\n');
  });
});
