# Specification 005 — Evaluate your own model in the browser

- Status: Implemented, awaiting owner review
- Date: 2026-10-19
- Scope: client only; no change to engine, API contract or business rules

## Requirements (EARS)

- **REQ-UP-01** When a visitor chooses or drops a `.glb` of at most 25 MB, the system shall evaluate it in the
  browser, show it in 3D and reveal the verdict like any sample.
- **REQ-UP-02** When the file is not a `.glb`, is empty or exceeds 25 MB, the system shall refuse it before reading
  it and show a localised message in an alert region.
- **REQ-UP-03** On every host other than a local development host, the system shall not send the visitor's file
  or any other request to an API; the page shall say that the file is evaluated in the browser.
- **REQ-UP-04** When the geometry cannot be read or drawn, the system shall never approve it: verdict `INCOMPLETE`
  and a message that the model could not be shown.
- **REQ-UP-05** All new texts shall exist in Spanish and English (catalogue parity test).

## Verification

`src/upload/validateUpload.test.ts` (rules and host check), `e2e/upload.spec.ts` (valid file, wrong type,
oversize, corrupt file, English). Depends on spec for the honest evaluator (watertightness from mesh data).
