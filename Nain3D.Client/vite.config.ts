import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? listFiles(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

/** Fills the service worker with the built files and a version derived from their content. */
function serviceWorkerManifest(): Plugin {
  let outDir = 'dist';
  return {
    name: 'nain3d-sw-manifest',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const skip = new Set(['sw.js', 'CNAME', 'robots.txt', 'sitemap.xml', 'og-image.png']);
      const files = listFiles(outDir)
        .map((file) => relative(outDir, file).split('\\').join('/'))
        .filter((file) => !skip.has(file))
        .sort();
      const hash = createHash('sha256');
      for (const file of files) hash.update(file).update(readFileSync(join(outDir, file)));
      const swPath = join(outDir, 'sw.js');
      const source = readFileSync(swPath, 'utf8')
        .replace("'__PRECACHE__'", JSON.stringify(['./', ...files]))
        .replace('__VERSION__', hash.digest('hex').slice(0, 12));
      writeFileSync(swPath, source);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [vue(), serviceWorkerManifest()],
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
