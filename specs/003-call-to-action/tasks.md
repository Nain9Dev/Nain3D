# Tasks 003 — Call to Action

Labels: `[A]` agent, `[M]` mixed, `[H]` owner only. Test first.

| ID | Task | Label | Done when | State |
|---|---|---|---|---|
| T-001 | Contact catalogue and tests (REQ-CTA-05) | [A] | `contacts.test.ts` green | Done |
| T-002 | i18n keys ES/EN and timeline of 5 s (REQ-CTA-02, -06) | [A] | parity and timeline tests green | Done |
| T-003 | Closing card in recording mode (REQ-CTA-01, -03) | [A] | captures in both formats and languages | Done (safe zone asserted in e2e) |
| T-004 | Footer contacts (REQ-CTA-04) | [A] | axe and keyboard e2e green | Done |
| T-005 | Docs, changelog, recording script | [A] | updated | Done |
| T-006 | Review the card wording and merge | [H] | owner decision | Open |

## Handoff (2026-10-18)

Done and verified: everything above; branch `feat/cta-contact`, based on `feat/detailed-hero-model`
(PR #2 is still open, so this PR targets that branch). Next: owner reviews the captures
`docs/assets/visual-redesign/after/record-*-5-end-card.png`; merge PR #2 first, then this one.
Not verified: the live site (nothing deployed).
