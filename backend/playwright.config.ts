import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/api',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: process.env.API_BASE_URL ?? 'http://127.0.0.1:3000',
  },
  reporter: [['list']],
});
