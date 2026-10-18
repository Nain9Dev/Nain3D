# Development Guidelines

## Project: Nain3D · 3D AI Conformance Gateway

### Virtual Environment & Backend (FastAPI on Port 8104)

```powershell
# Run tests
.\.venv\Scripts\pytest tests/ -v

# Start FastAPI backend
.\.venv\Scripts\uvicorn src.nain3d.main:app --port 8104 --reload
```

Interactive API documentation available at: `http://localhost:8104/docs`

### Frontend Client (Vue 3 + TypeScript on Port 5376)

```powershell
cd Nain3D.Client
npm install
npm run dev
```

Interactive 3D model inspector available at: `http://localhost:5376`

### Architecture & Standards

- Backend: FastAPI, Pydantic v2, Trimesh, Scikit-learn Random Forest, optional Ollama LLM integration.
- Frontend: Vue 3, TypeScript, Vite, three.js (ADR-002). Client checks: `npm run lint`, `npm test`, `npm run test:e2e` (after `npm run build`).
- Core rule: Fail-closed deterministic conformance. The AI proposes; the technical contract decides.
