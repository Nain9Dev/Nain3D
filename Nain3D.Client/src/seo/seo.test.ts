import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { es } from '../i18n/es';

const client = (path: string) => fileURLToPath(new URL(`../../${path}`, import.meta.url));
const repo = (path: string) => fileURLToPath(new URL(`../../../${path}`, import.meta.url));
const html = readFileSync(client('index.html'), 'utf8');

// Terms that belong to the Contrast3D x NainDev commercial offer (see Presence-And-SEO, 50-keywords).
const RESERVED = /visor|viewer|showroom|configurador|configurator|validador|validator|\bcgi\b|ar\/vr|peritaje/i;

function meta(attr: 'name' | 'property', key: string): string {
  const match = new RegExp(`<meta\\s+${attr}="${key}"\\s+content="([^"]*)"`).exec(html);
  expect(match, `${attr}=${key}`).not.toBeNull();
  return match![1];
}

const jsonLd = (() => {
  const match = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
  expect(match).not.toBeNull();
  return JSON.parse(match![1]);
})();

describe('page metadata', () => {
  const title = /<title>([^<]*)<\/title>/.exec(html)![1];
  const description = meta('name', 'description');

  it('has a short title naming the project and the brand', () => {
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title).toContain('Nain3D');
    expect(title).toContain('NainDev');
  });

  it('has a description of 70 to 160 characters', () => {
    expect(description.length).toBeGreaterThanOrEqual(70);
    expect(description.length).toBeLessThanOrEqual(160);
  });

  it('keeps the alliance keywords out of every search-facing text', () => {
    const texts = [title, description, meta('property', 'og:title'), meta('property', 'og:description'), JSON.stringify(jsonLd)];
    for (const text of texts) expect(text).not.toMatch(RESERVED);
  });

  it('declares canonical, hreflang alternates and social tags', () => {
    expect(html).toContain('<link rel="canonical" href="https://3d.naindev.com/" />');
    for (const lang of ['es', 'en', 'x-default']) expect(html).toContain(`hreflang="${lang}"`);
    expect(meta('property', 'og:url')).toBe('https://3d.naindev.com/');
    expect(meta('property', 'og:image')).toBe('https://3d.naindev.com/og-image.png');
    expect(meta('name', 'twitter:card')).toBe('summary_large_image');
    expect(meta('property', 'og:locale')).toBe('es_ES');
  });
});

describe('structured data', () => {
  it('describes a web application authored by the owner', () => {
    expect(jsonLd['@type']).toBe('WebApplication');
    expect(jsonLd.url).toBe('https://3d.naindev.com/');
    expect(jsonLd.author['@type']).toBe('Person');
    expect(jsonLd.author.name).toBe('Aitor Nain Mendoza Vallejo');
    expect(jsonLd.author.url).toBe('https://www.naindev.com/');
    expect(jsonLd.author.sameAs).toEqual(
      expect.arrayContaining(['https://github.com/Nain9Dev', expect.stringContaining('linkedin.com/in/aitor-nain-mendoza-vallejo')]),
    );
  });

  it('does not mention the partner studio or a personal address', () => {
    const text = JSON.stringify(jsonLd) + html;
    expect(text).not.toMatch(/contrast ?3d/i);
    expect(text).not.toMatch(/gmail\.com/i);
  });
});

describe('no-JavaScript content', () => {
  it('ships a heading, a summary and contact links inside the app container', () => {
    const app = /<div id="app">([\s\S]*?)<\/div>\s*<script type="module"/.exec(html)![1];
    expect(app).toMatch(/<h1>[^<]+<\/h1>/);
    expect(app).toContain('mailto:contact@naindev.com');
    expect(app).toContain('https://github.com/Nain9Dev/Nain3D');
    expect(app).not.toMatch(RESERVED);
  });
});

describe('language-aware metadata', () => {
  it('has a title and a description in both catalogues, within the same limits', () => {
    for (const catalogue of [es, en]) {
      expect(catalogue['meta.title'].length).toBeLessThanOrEqual(60);
      expect(catalogue['meta.description'].length).toBeGreaterThanOrEqual(70);
      expect(catalogue['meta.description'].length).toBeLessThanOrEqual(160);
      expect(catalogue['meta.title'] + catalogue['meta.description']).not.toMatch(RESERVED);
    }
  });

  it('keeps the Spanish catalogue identical to the static HTML', () => {
    expect(es['meta.title']).toBe(/<title>([^<]*)<\/title>/.exec(html)![1]);
    expect(es['meta.description']).toBe(meta('name', 'description'));
  });
});

describe('crawler files', () => {
  it('allows crawling and declares the sitemap', () => {
    const robots = readFileSync(client('public/robots.txt'), 'utf8');
    expect(robots).toMatch(/User-agent: \*\s+Allow: \//);
    expect(robots).toContain('Sitemap: https://3d.naindev.com/sitemap.xml');
  });

  it('lists the home page in the sitemap', () => {
    const sitemap = readFileSync(client('public/sitemap.xml'), 'utf8');
    expect(sitemap).toContain('<loc>https://3d.naindev.com/</loc>');
  });

  it('ships a 1200x630 social image', () => {
    const path = client('public/og-image.png');
    expect(existsSync(path)).toBe(true);
    const png = readFileSync(path);
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  });
});

describe('case study', () => {
  const caseStudy = readFileSync(repo('docs/case-study.md'), 'utf8');

  it('only links to files that exist', () => {
    const links = [...caseStudy.matchAll(/\]\((?!https?:|#)([^)#]+)(?:#[^)]*)?\)/g)].map((m) => m[1]);
    expect(links.length).toBeGreaterThan(8);
    for (const link of links) expect(existsSync(repo(`docs/${link}`)), link).toBe(true);
  });

  it('is linked from the README and from the page footer', () => {
    expect(readFileSync(repo('README.md'), 'utf8')).toContain('docs/case-study.md');
    expect(readFileSync(client('src/App.vue'), 'utf8')).toContain('blob/main/docs/case-study.md');
  });

  it('has the footer label in both languages', () => {
    expect(es['footer.caseStudy']).toBe('Caso de estudio');
    expect(en['footer.caseStudy']).toBe('Case study');
  });
});

describe('repository presentation', () => {
  const readme = readFileSync(repo('README.md'), 'utf8');

  it('is accurate and credits the third-party model', () => {
    // model-viewer may appear only as the rejected alternative, never as part of the current stack.
    expect(readme).not.toMatch(/three\.js\s*\/\s*model-viewer|model-viewer\s*\)/i);
    expect(readme).not.toMatch(/9\/9/);
    expect(readme).toContain('Materials Variants Shoe');
    expect(readme).toContain('CC BY 4.0');
    expect(readme).toContain('contact@naindev.com');
    expect(readme).toContain('THIRD_PARTY_NOTICES.md');
  });

  it('documents every third-party asset and font', () => {
    const notices = readFileSync(repo('THIRD_PARTY_NOTICES.md'), 'utf8');
    for (const needle of ['Shopify', 'CC BY 4.0', 'Urbanist', 'IBM Plex Mono', 'SIL Open Font License', 'three.js']) {
      expect(notices).toContain(needle);
    }
  });
});
