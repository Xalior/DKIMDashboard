## Implementation: Cross-domain SigningTable entries in DKIM Dashboard

**Status:** In Progress
**Branch:** `feature/signingtable-cross-domain`
**Plan:** [plan_signingtable-cross-domain.md](plan_signingtable-cross-domain.md)

## Tasks

- [ ] Phase 1: SigningTable first-class + scaffolding
  - [x] Scaffolding (Makefile, vitest, package.json scripts, .gitignore, docker-compose container_name, README)
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
- 2026-04-14 — Scaffolding landed: Makefile, vitest config + dev deps, .gitignore `.tmp.*` pattern (0c6267c); docker-compose container_name + README single-instance note (270e1e9). `make typecheck` and `make lint` both green against the pre-existing codebase.

## Decisions & Notes

- Branched from `dev`, not `main`, per user direction. PR will target `dev`.
- `.gitignore` had a stray trailing-newline delete in the working tree at start; discarded as incidental.
- Project uses **pnpm** (active lockfile). Shell aliases `npm` → `pnpm`. Makefile uses `npx` which resolves against either. No decision taken on removing the stale `package-lock.json`; left in place since it is unmaintained but not causing harm.

## Blockers

_None._

## Commits

- `922cc5a` — docs: add pre-plan and plan for cross-domain SigningTable
- `3144a7a` — chore: init implementation tracker for signingtable-cross-domain
- `6c0cc21` — chore: move implementation tracker into docs/plans/
- `0c6267c` — chore: add Makefile, vitest, and test tooling scaffolding
- `270e1e9` — chore: codify single-instance deployment invariant
