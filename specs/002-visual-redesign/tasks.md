# Tasks 002 — Visual Redesign

Labels: `[A]` agent, `[M]` mixed, `[H]` owner only. One task at a time, test first.

| ID | Task | Label | Done when | State |
|---|---|---|---|---|
| T-001 | Fix `api.ts` telemetry type error so the build gate runs | [A] | `npm run build` exits 0 | Done |
| T-002 | Baseline: bundle, LCP, screenshots | [A] | numbers in `docs/visual-redesign-metrics.md` | Done |
| T-003 | Vitest, ESLint, Playwright tooling and scripts | [A] | `npm run lint`, `npm test`, `npm run test:e2e` | Done (ADR-005 Proposed) |
| T-004 | i18n catalogue (es source, en typed) with parity test | [A] | test fails on missing/extra key | Done (ADR-004 Proposed) |
| T-005 | Brand tokens and self-hosted fonts | [M] | no third-party font request; owner confirms font licences | Agent part done; **owner: confirm OFL licences (ADR-006)** |
| T-006 | Language switch, `?lang=`, localStorage, `<html lang>` sync | [A] | e2e language test green | Done |
| T-007 | Every UI string in the catalogue | [A] | no-literal-string test green | Done |
| T-008 | Sample generator, deterministic GLBs | [A] | same bytes on two runs | Done (ADR-003 Proposed) |
| T-009 | pytest: each GLB evaluates to its expected verdict | [A] | `pytest tests/ -v` green | Done (20 passed) |
| T-010 | three.js scene: PBR, environment, soft shadow, eased rotation | [A] | renders in Playwright | Done (ADR-002 Proposed) |
| T-011 | Scale overlay: red bbox, limit box, ruler from API data | [A] | overlay unit test | Done |
| T-012 | Authored mesh defects visible in a non-conformant sample | [A] | owner-reviewed capture | **Deferred**: the in-browser evaluator cannot fail mesh defects and the API gives no face positions (spec section 5) |
| T-013 | Verdict reveal timeline, reduced-motion path | [A] | timeline unit tests | Done |
| T-014 | Conformant / non-conformant switch gesture | [A] | keyboard + button e2e | Done |
| T-015 | `?mode=record` layouts 9:16 and 16:9 | [A] | no scroll at both sizes | Done |
| T-016 | Deterministic clock and step API | [A] | identical captures across runs | Done (`?clock=manual`, `__nain.advance`) |
| T-017 | WCAG 2.2 AA pass | [A] | 0 axe violations | Done (es and en, both verdicts) |
| T-018 | Final perf measurement | [A] | table in metrics doc | Done |
| T-019 | Before/after captures, both languages | [A] | files in `docs/assets/visual-redesign/` | Done |
| T-020 | `docs/demo-recording-script.md` | [A] | sequence under 30 s | Done (20 s) |
| T-021 | Docs, changelog, traceability, handoff | [A] | gate output attached | Done |
| T-022 | Approve ADR-002..006; refresh `AGENTS.md` and `CLAUDE.md` (they said `<model-viewer>`) | [H] | ADRs `Approved` | Done (approved by owner 2026-10-18) |
| T-023 | Decide whether the 26 PNG captures (about 15 MB) stay in git or move to release assets | [H] | decision recorded | Open |
| T-024 | Merge to `master`; deploy to 3d.naindev.com (push to `master` deploys) | [H] | owner authorises | Open; nothing committed or pushed |

## Handoff (2026-10-18)

Done and verified: everything above marked Done; gate output in the final report (`pytest tests/ -v`
20 passed; client `npm run build`, `npm run lint`, `npm test` 32 passed, `npm run test:e2e` 12 passed).
Next: owner review of the captures and ADRs, then T-022 to T-024.
Blocked: nothing. Not verified: real-GPU rendering performance; the Python API serving the client in dev
(`/api` proxy) beyond `tests/test_hero_samples.py`.
Notes: `AGENTS.md` cites `docs/decisions/`; the real folder is `docs/03-decisions/`. The Starlette
`httpx` deprecation warning in pytest predates this work.
Working tree: worktree `D:\wt\nain3d-visual-redesign`, branch `feat/visual-redesign`, uncommitted.
