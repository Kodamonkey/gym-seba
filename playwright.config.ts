import { defineConfig, devices } from '@playwright/test';

/**
 * E2E sobre la build de producción (incluye service worker). Usa el Microsoft Edge
 * instalado en el sistema (`channel: 'msedge'`), sin descargar navegadores.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    channel: 'msedge',
    ...devices['Pixel 7'],
    browserName: 'chromium',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
