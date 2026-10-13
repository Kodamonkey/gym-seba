import { defineConfig } from '@playwright/test';
import config from './playwright.config';

/** Regresión sobre la subcarpeta de GitHub Pages y el alcance real del service worker. */
export default defineConfig(config, {
  testDir: 'tests/pages',
  outputDir: 'test-results/pages',
  use: { baseURL: 'http://localhost:4175/gym-seba/' },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4175 --strictPort',
    url: 'http://localhost:4175/gym-seba/',
    env: { ATLAS_BASE: '/gym-seba/' },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
