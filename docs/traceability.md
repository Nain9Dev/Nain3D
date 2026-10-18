# Traceability Matrix — Nain3D Gateway

| Requirement | Contract / Rule | Implementing Code | Verifying Test | State |
|:---|:---|:---|:---|:---:|
| Triangle Budget Enforcement | `budget_triangles` | `src.nain3d.engine.evaluator` | `tests/test_evaluator.py::test_conforming_chair_passes_contract` | Verified |
| Physical Metric Scale Bound | `metric_scale` | `src.nain3d.engine.evaluator` | `tests/test_evaluator.py::test_oversized_scale_fails_contract` | Verified |
| Watertight Solid Integrity | `integrity_watertight` | `src.nain3d.engine.evaluator` | `tests/test_evaluator.py::test_industrial_part_requires_watertightness` | Verified |
| Synthetic Model Evaluation | `POST /evaluate` | `src.nain3d.api.routes` | `tests/test_api.py::test_evaluate_sample_model` | Verified |
| Health Liveness & Readiness | `GET /health` | `src.nain3d.main` | `tests/test_api.py::test_liveness_and_readiness_endpoints` | Verified |
| Profiles Registry Query | `GET /profiles` | `src.nain3d.api.routes` | `tests/test_api.py::test_list_profiles` | Verified |
| Synthetic Samples Streaming | `GET /samples` | `src.nain3d.api.routes` | `tests/test_api.py::test_list_and_download_samples` | Verified |
| REQ-VR-01..03 Hero samples keep verdicts, deterministic | spec 002 | `Nain3D.Client/tools/generate-samples.mjs`, `routes.py` | `tests/test_hero_samples.py` | Verified |
| REQ-VR-04 Scale overlay from payload, fail-closed | spec 002 | `src/scene/overlay.ts`, `src/scene/stage.ts` | `src/scene/overlay.test.ts`; `e2e/captures.spec.ts` | Verified |
| REQ-VR-05 Mesh defects not computed by the client | spec 002 | `src/viewModel.ts` | `src/viewModel.test.ts` | Deferred (no sample; see spec 002 section 5) |
| REQ-VR-06..08 Reveal timeline, compare, reduced motion | spec 002 | `src/timeline.ts`, `src/App.vue` | `src/timeline.test.ts`; `e2e/quality.spec.ts` | Verified |
| REQ-VR-09..11 Recording mode, formats, languages | spec 002 | `src/state/urlState.ts`, `src/style.css` | `src/state/urlState.test.ts`; `e2e/captures.spec.ts`; `e2e/quality.spec.ts` | Verified |
| REQ-VR-12 Brand tokens | spec 002 | `src/styles/tokens.css`, `src/style.css` | visual captures | Verified |
| REQ-VR-13..15 Languages, catalogue parity | spec 002 | `src/i18n/` | `src/i18n/i18n.test.ts`; `e2e/quality.spec.ts` | Verified |
| REQ-VR-16 WCAG 2.2 AA | spec 002 | components | `e2e/quality.spec.ts` (axe, keyboard) | Verified |
| REQ-VR-17 LCP and bundle measured | spec 002 | `scripts/measure.mjs` | `docs/visual-redesign-metrics.md` | Verified |
| REQ-VR-18 Captures in both formats and languages | spec 002 | `e2e/captures.spec.ts` | `docs/assets/visual-redesign/after/` | Verified |
