import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5376',
    launchOptions: {
      // Software WebGL so the 3D scene renders in headless CI and on machines without a GPU.
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  webServer: {
    // Serves the production build; run `npm run build` first.
    command: 'npx vite preview --port 5376 --strictPort',
    url: 'http://localhost:5376',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
