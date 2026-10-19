# Security Policy

## Reporting a vulnerability

This project is part of the engineering portfolio of **Aitor Nain Mendoza Vallejo (`NainDev`)**. If you find a
vulnerability or an unexpected attack vector (for example a malicious GLB that crashes the parser or exhausts
memory), please report it responsibly:

- **Email:** `contact@naindev.com`
- **Response window:** within 48 business hours.

## What is protected, and how

| Area | Safeguard | Where it is checked |
|:---|:---|:---|
| Uploads in the public site | Evaluated in the browser; no request is sent to any API outside local development. Only `.glb`, not empty, at most 25 MB; unreadable geometry is never approved (`INCOMPLETE`) | `Nain3D.Client/src/upload/`, `src/services/backend.ts`, `e2e/upload.spec.ts` |
| Uploads in the API (local development) | Only `.glb` (415), at most 50 MB (413), binary glTF header checked before parsing (422), reads at most the limit plus one byte | `src/nain3d/api/routes.py`, `tests/test_upload_limits.py` |
| Sample downloads | Only the known sample ids are served; anything else is a 404 | `tests/test_upload_limits.py` |
| Browser | Content-Security-Policy as a meta tag (GitHub Pages cannot send headers): same-origin by default, scripts only from this site and the NainDev ecosystem bar, no inline or eval scripts, no plugins; strict referrer policy | `Nain3D.Client/index.html`, `src/seo/csp.test.ts`, `e2e/quality.spec.ts` |
| Dependencies | `npm audit`, `pip-audit` and Trivy report nothing; Dependabot opens weekly update PRs for npm, pip and GitHub Actions | `.github/dependabot.yml` |
| CI | Actions pinned to commit hashes, read-only token, no persisted credentials; actionlint and zizmor clean | `.github/workflows/ci.yml` |
| Secrets | gitleaks over the full history reports nothing; no secrets are used by the project | CI and local checks |

## Boundaries and constraints

1. **Synthetic or licensed data only.** The repository processes synthetic models and one CC BY model credited in
   `THIRD_PARTY_NOTICES.md`. Confidential, proprietary or personal data must not be uploaded or committed.
2. **Local compute.** In-browser and local operation have zero billable cloud activation. The Python API is not hosted publicly.
3. **Known limits.** The CSP keeps `style-src 'unsafe-inline'` because Vue writes inline style bindings, and it
   trusts `https://www.naindev.com` for the ecosystem bar script (same owner, no subresource integrity because
   the script is updated in place). `frame-ancestors` cannot be set from a meta tag.
