# Specification 003 — Call to Action

- Document version: 1.0
- Status: Implemented, awaiting owner review
- Date: 2026-10-18
- Scope: presentation only (`Nain3D.Client`); no change to business rules, API contracts or schemas

## 1. Problem statement

The demo shows the engine well but ends without telling the viewer what to do next. The audience is
recruiters and CTOs; the wanted action is to write to the owner or open the portfolio and the code
(interview, 2026-10-18).

## 2. Requirements (EARS)

- **REQ-CTA-01** When the recording sequence reaches its end, the system shall show a closing card with the
  owner's name, the headline *Arquitecto de software full stack* (English: *Full stack software architect*), the
  NainDev brand and four contacts: `naindev.com`, `contact@naindev.com`, LinkedIn and the project's GitHub.
- **REQ-CTA-02** The closing card shall stay on screen for at least 5 s and the whole recording shall stay under 30 s.
- **REQ-CTA-03** The closing card shall fit 1080x1920 inside the platform safe zones (230 px top, 340 px bottom) and
  1920x1080 without scrolling, in Spanish and English.
- **REQ-CTA-04** In the standard page, the footer shall list the same four contacts as keyboard-reachable links
  with accessible names, and shall no longer link to the retired repository name.
- **REQ-CTA-05** The contact data shall live in one catalogue; the public email is `contact@naindev.com` and no
  other address shall appear in the client.
- **REQ-CTA-06** All visible text shall come from the i18n catalogue or the contact catalogue (proper names and
  addresses), keeping the ES/EN parity test green.

## 3. Out of scope

QR codes, forms, analytics, any server-side contact handling.

## 4. Handoff state

See `tasks.md`. Contact lines use the channel name plus a short readable value (LinkedIn is shown as
`in/aitor-nain-mendoza-vallejo`, GitHub as `github.com/Nain9Dev/Nain3D`) so each fits one line at 1080 px.
