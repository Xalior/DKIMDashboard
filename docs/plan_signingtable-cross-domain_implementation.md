## Implementation: Cross-domain SigningTable entries in DKIM Dashboard

**Status:** In Progress
**Branch:** `feature/signingtable-cross-domain`
**Plan:** [docs/plans/plan_signingtable-cross-domain.md](plans/plan_signingtable-cross-domain.md)

## Tasks

- [ ] Phase 1: SigningTable first-class + scaffolding
  - [ ] Scaffolding (Makefile, vitest, package.json scripts, .gitignore, docker-compose container_name, README)
  - [ ] Atomic-fs + write-lock + errors (libs + tests)
  - [ ] signing-table parser/writer + fixtures + tests
  - [ ] Refactor lib/opendkim.ts addDomain/removeDomain onto new writer
  - [ ] API routes /api/rules/signing + /api/rules/signing/[id] + tests
  - [ ] UI routes /rules/signing, /rules/signing/new, /rules/signing/[id]
  - [ ] Help surface (HelpModal, AboutThisPage, RowHelp, FieldTooltip + content)
  - [ ] Navbar + /domains back-link
  - [ ] Automated success criteria (make ci)
  - [ ] Manual success criteria (user-verified)
- [ ] Phase 2: KeyTable thin (read-only UI, round-trip writer) — re-review after Phase 1
- [ ] Phase 3: TrustedHosts first-class — re-review after Phase 2

## Progress Log

- 2026-04-14 — Branch created from `dev` at 3e391bf. Plan + pre-plan committed (922cc5a). Implementation tracker initialised.

## Decisions & Notes

- Branched from `dev`, not `main`, per user direction. PR will target `dev`.
- `.gitignore` had a stray trailing-newline delete in the working tree at start; discarded as incidental.

## Blockers

_None._

## Commits

- `922cc5a` — docs: add pre-plan and plan for cross-domain SigningTable
