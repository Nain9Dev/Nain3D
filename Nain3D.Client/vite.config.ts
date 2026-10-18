import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [vue()],
  server: {
    port: 5376,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8104',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:8104',
        changeOrigin: true,
      },
    },
  },
  build: {
    // The lazily loaded three.js chunk is ~0.7 MB minified (about 180 kB gzip); the app shell stays small.
    chunkSizeWarningLimit: 900,
  },
  preview: {
    port: 5376,
    strictPort: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
