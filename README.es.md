<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/banner-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="docs/assets/banner-light.svg">
  <img alt="Nain3D architecture blueprint" src="docs/assets/banner-dark.svg" width="100%">
</picture>

# Nain3D Gateway

**Un contrato de conformidad determinista para activos 3D, con un clasificador de IA que propone y nunca decide.**
Un caso de estudio de arquitectura por [NainDev](https://www.naindev.com): backend FastAPI, cliente Vue 3, registros de decisiones arquitectónicas, pruebas y comprobaciones de accesibilidad, todo en abierto.

[![English](https://img.shields.io/badge/Language-English-blue?style=flat-square)](README.md)
[![Español](https://img.shields.io/badge/Idioma-Espa%C3%B1ol-emerald?style=flat-square)](README.es.md)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-3d.naindev.com-0284c7?style=flat-square&logo=google-chrome&logoColor=white)](https://3d.naindev.com/)
[![CI](https://github.com/Nain9Dev/Nain3D/actions/workflows/ci.yml/badge.svg)](https://github.com/Nain9Dev/Nain3D/actions/workflows/ci.yml)
[![Python 3.12](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Pydantic v2](https://img.shields.io/badge/Pydantic-v2-E92063?logo=pydantic&logoColor=white)](https://docs.pydantic.dev/)
[![Vue 3](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vuedotjs&logoColor=white)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Architecture tests](https://img.shields.io/badge/Architecture%20tests-Clean%20Arch%20enforced-80FF00?style=flat-square&logoColor=black)](tests/test_architecture.py)
[![License: MIT](https://img.shields.io/badge/License-MIT-informational)](LICENSE)

![Nain3D demo: zapatilla conforme, propuesta de IA y comprobaciones de contrato](docs/assets/demo-en.png)

> **"La IA propone, el contrato dispone."**  
> *(The AI proposes, the contract decides.)*

La capa de IA predice una categoría y un nivel de confianza. El motor determinista evalúa a continuación el modelo frente a límites estrictos: presupuesto de triángulos, extensión física, hermeticidad y caras degeneradas. Una comprobación bloqueante fallida rechaza el activo, sin importar lo que estime la IA. El sistema es fail-closed.

## Compruébalo en 60 segundos

| Quiero… | Dónde |
|:---|:---|
| Probarlo | [3d.naindev.com](https://3d.naindev.com) (Español por defecto, Inglés con `?lang=en`). Pulsa **C** para comparar un modelo conforme con uno no conforme |
| Ver la historia en 20 s | `https://3d.naindev.com/?mode=record` (diseño fijo 9:16 o 16:9, consulta [el guión de grabación](docs/demo-recording-script.md)) |
| Consultar la API | `http://localhost:8104/docs` tras iniciar el backend |
| Conocer el estado actual | [Estado del proyecto](docs/project-status.md): qué existe, qué está pausado, cómo reanudar |
| Entender el diseño | El [caso de estudio](docs/case-study.md): problema, regla, arquitectura, decisiones, límites |
| Revisar la ingeniería | [Especificaciones](specs/), [registros de decisiones](docs/03-decisions/), [arquitectura](docs/01-architecture.md), [métricas](docs/visual-redesign-metrics.md) |
| Ejecutar las pruebas | Comandos descritos a continuación |

## Arquitectura

```mermaid
graph TD
    User["Cliente Web<br/>(Vue 3 + TypeScript + three.js)"]
    Gateway["Pasarela de conformidad FastAPI<br/>(Python 3.12 / Pydantic v2)"]
    AI["Subsistema IA<br/>('La IA propone': Random Forest / LLM local opcional)"]
    Engine["Motor geométrico determinista<br/>('El contrato dispone': Trimesh + NumPy)"]
    Verdict["Agregador fail-closed<br/>(informe de contrato dual)"]

    User -->|Subida GLB| Gateway
    Gateway --> AI
    Gateway --> Engine
    AI -->|propuesta de categoría| Verdict
    Engine -->|métricas exactas de malla| Verdict
    Verdict -->|veredicto vinculante| User
```

## Ejecución Local

### Backend (Python 3.12 / FastAPI en puerto 8104)

```powershell
.\.venv\Scripts\uvicorn src.nain3d.main:app --port 8104 --reload
```

### Frontend (Vue 3 / Vite en puerto 5376)

```powershell
cd Nain3D.Client
npm install
npm run dev
```

### Pruebas Automatizadas

```powershell
.\.venv\Scripts\pytest tests/ -v
npm --prefix Nain3D.Client run build
npm --prefix Nain3D.Client run test
```

## Autor

**Aitor Nain Mendoza Vallejo (`NainDev`)**  
Arquitecto Full Stack & Ingeniero de Software 3D  
[naindev.com](https://www.naindev.com) · contact@naindev.com
