# Project status

Last updated: 2026-10-19. State: **stable, paused by the owner**. The live demo at
[3d.naindev.com](https://3d.naindev.com) is considered finished for now.

## What exists

- Deterministic conformance engine and API (Python, FastAPI, Trimesh), four contract checks, fail-closed verdict.
- Vue 3 client with a three.js stage, animated verdict, scale overlay, Spanish and English, recording mode,
  call to action, user uploads evaluated in the browser, and a photoreal CC BY hero model.
- Search presence positioned as an engineering case study; case study, specs 001 to 005, ADR-001 to ADR-007.
- CI on every pull request (pytest, ESLint, Vitest, build, Playwright with axe), Dependabot, security review.

## Paused on purpose

| Item | Why it waits |
|:---|:---|
| Audio or music for the recorded video | Will be edited later by the owner |
| Link back from contrast3d.com and keyword split with the partner | Not a priority now (SEO folder, action A-031) |
| Hosting the Python engine publicly | Zero-cost constraint |

## Open for the owner

- Submit `https://3d.naindev.com/sitemap.xml` in Search Console (action A-032).
- naindev.com: link the demo and correct `ecosystem.v1.json` (action A-030, other repository).

## How to resume

1. Read `docs/changelog.md` and the newest folder in `specs/`; start any change as a spec with the test first.
2. Run the gate: `pytest tests/`, then in `Nain3D.Client`: `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e`.
3. Open a pull request; CI repeats the gate. Merging to `main` deploys to GitHub Pages.
4. Candidate improvements, if work resumes: host the engine behind the same API, return face positions so the
   client can highlight defects, add the Khronos validator as an optional blocking check, release assets instead of
   screenshots in git.

## Maintenance

- Weekly Dependabot pull requests: merge when CI is green.
- Regenerate captures and the social image after visual changes:
  `npm run build && npm run test:e2e` and `npx playwright test e2e/og-image.spec.ts`.
- Export the video: `npm run record:video` (see [the recording script](demo-recording-script.md)).
- Known limits are listed in [the case study](case-study.md) and in [SECURITY.md](../SECURITY.md).
