# AGENTS.md — canonical constitution for this repository

This file governs every automated agent and every human contributor working inside
`3d-ai-conformance-demo` (commercial brand: **Nain3D** / **Nain3D Gateway**). It is the highest-priority
instruction set in this directory tree.

## 1. What this repository is

A **Deterministic 3D Asset Conformance Engine and AI Classification Gateway**:
A Python 3.12 (FastAPI + Pydantic v2) modular backend paired with a reactive Vue 3 + TypeScript
interactive 3D inspection showcase (`Nain3D.Client`).

It operationalizes the governing philosophy:
> *"La IA propone, el contrato dispone."*
> (The AI proposes, the technical contract decides.)

The AI layer infers asset category, confidence score, and candidate profile. The deterministic
geometry engine evaluates the asset against strict mathematical contracts (triangle budgets, scale
bounds, watertightness, manifold integrity). Under no circumstances may an AI prediction override
a failing contract.

It is also an engineering proof asset for [naindev.com](https://www.naindev.com) showcasing 3D
computational geometry, deterministic validation, and modern web integration.

## 2. Authority order

1. Safety, confidentiality, and data preservation.
2. Approved ADRs in `docs/decisions/` within their stated scope.
3. `docs/02-business-rules.md` — approved conformance rules and profile contracts.
4. `docs/01-architecture.md` — architectural invariants and boundaries.
5. Versioned code and tests.
6. `specs/NNN-*/` — active change specification.

## 3. Non-negotiable boundaries

- **Strict isolation & confidentiality:** No proprietary or client-confidential code, data, or business
  rules may be copied into or referenced from this repository.
- **Fail-closed rule:** A single failing contract check guarantees asset rejection. Incomplete or
  unhandled evaluations fail closed.
- **Dual-contract architecture:** The deterministic mathematical evaluation is separated from
  environmental/runtime audit metadata.
- **Zero paid infrastructure:** Operates strictly on open-source libraries and local compute.
- **Assigned dev ports:** API on port `8104`, Vue 3 client on port `5376`.

## 4. Layering

```text
src/nain3d/
  ├── api/          # FastAPI routes, dependencies, schemas, CORS, OpenAPI
  ├── domain/       # Pydantic v2 domain models, contracts, profile specifications
  ├── engine/       # Trimesh geometry analysis, bounds, watertightness, polygon budgets
  └── ml/           # Local classification models (Random Forest inference + Ollama LLM client)
Nain3D.Client/      # Vue 3 + TypeScript + Vite 3D interactive viewer (three.js, ADR-002)
```

## 5. Verification gate

A change is finished only when:
```bash
.\.venv\Scripts\pytest tests/ -v
npm --prefix Nain3D.Client run build
```
Warnings are treated as errors. All tests must pass before declaring work complete.

## 6. Language rules

Everything in this repository is written in professional, concise **English**: code, identifiers,
commit messages, documentation, and comments. Text shown to end users in the frontend UI may support
bilingual presentation (Spanish / English) for portfolio demonstration.

## 7. Commits

Conventional Commits, English subject: `<type>(<scope>): <description>`.
No dates in messages; no tool or AI trailers. Commits authored solely by the repository owner.
Do not commit or push unless explicitly authorized.
