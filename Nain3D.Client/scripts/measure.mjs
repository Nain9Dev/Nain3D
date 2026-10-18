// Measures cold LCP, time to the first 3D frame and transferred bytes, and takes key-state screenshots.
// Usage: node scripts/measure.mjs <baseUrl> <outDir> [nonConformantLabelRegex] [direct]
//   "direct": the UI lists samples on the page (redesign); omit for the old drawer UI.
// Same-origin text assets are gzip-compressed for the byte count because `vite preview` serves them raw;
// cross-origin responses use their real transfer size.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const [baseUrl, outDir, nonConformantPattern = 'Gigante|Oversized', mode] = process.argv.slice(2);
if (!baseUrl || !outDir) {
  console.error('usage: node scripts/measure.mjs <baseUrl> <outDir> [regex] [direct]');
  process.exit(2);
}
mkdirSync(outDir, { recursive: true });
const origin = new URL(baseUrl).origin;
const VIEWPORT = { width: 1920, height: 1080 };

const browser = await chromium.launch({
  // Software WebGL, identical for the baseline and the redesign so numbers are comparable.
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

const lcpObserver = () => {
  window.__lcp = 0;
  new PerformanceObserver((list) => {
    const entries = list.getEntries();
    window.__lcp = entries[entries.length - 1].startTime;
  }).observe({ type: 'largest-contentful-paint', buffered: true });
};

async function measureCold() {
  const context = await browser.newContext({ viewport: VIEWPORT }); // Fresh context: empty HTTP cache.
  const page = await context.newPage();
  await page.addInitScript(lcpObserver);
  let bytes = 0;
  const hosts = new Set();
  const pending = [];
  page.on('response', (res) => {
    pending.push(
      (async () => {
        try {
          const url = new URL(res.url());
          hosts.add(url.host);
          const type = res.headers()['content-type'] ?? '';
          if (url.origin === origin && /javascript|css|html|svg|json/.test(type)) {
            bytes += gzipSync(await res.body()).length;
          } else {
            const sizes = await res.request().sizes();
            bytes += sizes.responseBodySize + sizes.responseHeadersSize;
          }
        } catch {
          // Redirects and aborted requests carry no body.
        }
      })(),
    );
  });
  const started = Date.now();
  await page.goto(baseUrl, { waitUntil: 'load' });
  const firstModelFrameMs = await page
    .waitForSelector('.app[data-ready="true"]', { timeout: 15000 })
    .then(() => Date.now() - started)
    .catch(() => null);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  const lcp = await page.evaluate(() => window.__lcp);
  await Promise.all(pending);
  await context.close();
  return { lcp: Math.round(lcp), firstModelFrameMs, bytes, hosts: [...hosts].sort() };
}

const runs = [];
for (let i = 0; i < 3; i += 1) runs.push(await measureCold());

const context = await browser.newContext({ viewport: VIEWPORT });
const page = await context.newPage();
await page.goto(baseUrl, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.screenshot({ path: join(outDir, 'start.png') });
if (mode !== 'direct') await page.getByRole('button').first().click();
await page.getByText(new RegExp(nonConformantPattern)).first().click();
await page.waitForTimeout(2500);
await page.screenshot({ path: join(outDir, 'non-conformant.png') });

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const result = {
  baseUrl,
  lcpMsRuns: runs.map((r) => r.lcp),
  lcpMsMedian: median(runs.map((r) => r.lcp)),
  firstModelFrameMsRuns: runs.map((r) => r.firstModelFrameMs),
  transferredBytesPerColdLoad: runs.map((r) => r.bytes),
  transferredBytesMedian: median(runs.map((r) => r.bytes)),
  hosts: runs[0].hosts,
};
writeFileSync(join(outDir, 'metrics.json'), JSON.stringify(result, null, 2));
console.log(result);
await browser.close();
