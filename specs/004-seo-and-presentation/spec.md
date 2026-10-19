# Specification 004 — Search Presence and Repository Presentation

- Document version: 1.0
- Status: Implemented, awaiting owner review
- Date: 2026-10-19
- Scope: `Nain3D.Client/index.html`, public files, README and third-party notices; no change to engine, API or UI behaviour

## 1. Context

3d.naindev.com and this repository are two of the pieces shown first to recruiters and CTOs. The SEO
folder (`D:\Development\NainDev\Presence-And-SEO`) assigns commercial 3D searches (viewer, validator,
showroom, configurator) to the Contrast3D x NainDev alliance and engineering searches to NainDev. A review of
contrast3d.com and naindev.com on 2026-10-19 showed Contrast3D sells visual work (CGI, immersive, showrooms,
configurators) and does not mention glTF validation, so the demo must stay on the engineering side.

## 2. Requirements (EARS)

- **REQ-SEO-01** The page shall have a Spanish title of at most 60 characters naming Nain3D and NainDev, and a
  description of 70 to 160 characters, positioned as an engineering case, not as a product.
- **REQ-SEO-02** Title, description, social tags and structured data shall not use the terms reserved for the
  alliance's commercial offer (viewer, showroom, configurator, validator, CGI, AR/VR, appraisal).
- **REQ-SEO-03** The page shall declare a canonical URL, `hreflang` alternates (es, en, x-default) and Open Graph
  and Twitter card tags with a 1200x630 image.
- **REQ-SEO-04** The page shall carry JSON-LD (`WebApplication`) whose author is the `Person` Aitor Nain Mendoza
  Vallejo with `sameAs` links, and that does not mention Contrast3D (the alliance is verbal; credits are the
  partner's decision).
- **REQ-SEO-05** Crawlers and people without JavaScript shall find a static heading, summary and contact links inside
  the app container, replaced on mount.
- **REQ-SEO-06** When the language changes, the document title and meta description shall follow it.
- **REQ-SEO-07** `robots.txt` shall allow crawling and declare `sitemap.xml`; the sitemap shall list the home page.
- **REQ-SEO-08** The README shall be in English, accurate about tests and the renderer, state the model credit and
  link the specs, ADRs and metrics. A `THIRD_PARTY_NOTICES.md` shall give author, licence and source of every
  third-party asset and font.

## 3. Out of scope

Changes to naindev.com or contrast3d.com (other repositories), paid SEO tools, analytics.

## 4. Handoff state

See `tasks.md`.
