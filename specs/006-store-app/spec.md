# Specification 006 — Installable app for online stores and catalogues

- Status: In progress (PR 1 of 5: contract and checks)
- Date: 2026-10-21
- Origin: owner interview, 2026-10-21

## 1. Real use case

**Who:** teams that publish 3D product models to an online store, catalogue or AR viewer.
**When:** a supplier or 3D artist sends a `.glb` (chat, mail, cloud). The reviewer opens the app on the phone,
checks the model against the store's own limits and forwards a one-page report to the supplier.
**What they take away:** a verdict with the reasons (which limit fails and by how much), the profile used, the
SHA-256 and the date, as a PDF shared from the phone's share menu.

## 2. Decisions from the interview

- The app is the same site (`3d.naindev.com`), made installable; no separate domain.
- Each store defines its own limits as editable profiles stored on the device; the four built-in profiles stay.
- Extra checks, all optional per profile: file weight (MB), maximum texture resolution, number of materials,
  UV coordinates and textures present.
- Output: a one-page PDF. History of the latest reviews is kept on the device only, never the file itself.
- Files stay in the browser (spec 005); the PDF is built in the browser.

## 3. Requirements (EARS)

### PR 1 — Contract and checks (this change)
- **REQ-ST-01** When a profile defines `max_file_mb`, `max_texture_px`, `max_materials` or `require_uv_and_textures`,
  the system shall add the matching blocking check after the four original ones; a profile that defines none shall
  run exactly the original four.
- **REQ-ST-02** When a texture cannot be measured (external file, unsupported format), the texture check shall fail
  (fail-closed).
- **REQ-ST-03** The Python engine and the in-browser evaluator shall give the same inventory and the same verdicts
  on the bundled samples (tests on both sides).
- **REQ-ST-04** Profile bounds shall be identical in both engines and a profile outside them shall be refused
  (API 422, client error), never evaluated.
- **REQ-ST-05** The API shall accept a custom profile as JSON (`custom_profile`); the new checks shall be shown
  localised (ES/EN) in the checklist.

### PR 2 — Store profiles
- **REQ-ST-06** The user shall create, edit, duplicate and delete profiles, kept in `localStorage`, and pick one for
  every review; invalid input shall be explained field by field.

### PR 3 — Report
- **REQ-ST-07** The user shall generate a one-page PDF (verdict, failing limits with values, profile, SHA-256, date,
  model capture, optional company and reference) and share it with the system share sheet, or download it where
  sharing is not available; language follows the interface.

### PR 4 — Installable app
- **REQ-ST-08** The site shall be installable (manifest, icons, theme) and its shell and samples shall work offline
  through a service worker that never caches API calls or user files.

### PR 5 — History
- **REQ-ST-09** The app shall list the last 20 reviews (name, verdict, profile, date, SHA-256; no file) on the device,
  with delete one and delete all.

## 4. Out of scope

Accounts, servers, uploading files anywhere, batch review (possible later), receiving files from the share sheet
(possible later).

## 5. Handoff state

See `tasks.md`.
