import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

// Los PNG de instalación se derivan del SVG propio. Usa Edge instalado, sin descargar navegadores.
const svg = await readFile(new URL('../public/icon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch({ channel: 'msedge' });
try {
  for (const [name, size, maskable] of [
    ['icon-192.png', 192, false],
    ['icon-512.png', 512, false],
    ['apple-touch-icon.png', 180, false],
    ['icon-maskable-512.png', 512, true],
  ]) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    const icon = maskable
      ? svg.replace('rx="14"', 'rx="0"').replace('<path', '<g transform="translate(8 8) scale(.75)"><path').replace('</svg>', '</g></svg>')
      : svg;
    await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;background:#edf2ec}svg{display:block;width:100%;height:100%}</style>${icon}`);
    await page.screenshot({ path: fileURLToPath(new URL(`../public/${name}`, import.meta.url)) });
    await page.close();
  }
} finally {
  await browser.close();
}
