# Specification next-seo-baseline — Shared discoverability baseline

- Status: Implemented, awaiting owner review
- Scope: `Nain3D.Client/index.html`, `Nain3D.Client/public/llms.txt`, `Nain3D.Client/src/seo/seo.test.ts`; no change to engine, API or UI behaviour
- Numbering: the spec number is assigned at merge (`next-` prefix); REQ-SEO-09 to REQ-SEO-11 continue spec 004.

## 1. Context

Spec 004 gave the page its metadata, canonical, hreflang, Open Graph, JSON-LD and crawler files. An audit against the baseline shared by the NainDev demo sites (2026-11-09) found four gaps. Everything else already conformed and is untouched.

## 2. Requirements (EARS)

- **REQ-SEO-09** The JSON-LD author `Person` shall carry the shared identifier `https://www.naindev.com/#person`, so search and answer engines can merge it with the entity declared on `naindev.com`, and the page shall link `rel="author"` to `https://www.naindev.com/`.
- **REQ-SEO-10** The Twitter card shall declare title, description and image equal to the Open Graph ones.
- **REQ-SEO-11** The site root shall serve `llms.txt`: Markdown whose first line is the H1 product name, followed by a one-line summary and the key links (demo, repository, main site), in English and without the terms reserved by spec 004 (REQ-SEO-02).

## 3. Out of scope

Title, description, canonical, hreflang, Open Graph, `robots.txt` and `sitemap.xml` (already conform, see spec 004); any change to the app.

## 4. Handoff state

Done and verified on 2026-11-09: `seo.test.ts` written first (2 failing groups), then the fix; Vitest 167 passed, ESLint and build pass. Not verified: how search engines render the page.
