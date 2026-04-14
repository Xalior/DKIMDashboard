## Implementation: Cross-domain SigningTable entries in DKIM Dashboard

**Status:** In Progress
**Branch:** `feature/signingtable-cross-domain`
**Plan:** [plan_signingtable-cross-domain.md](plan_signingtable-cross-domain.md)

## Tasks

- [ ] Phase 1: SigningTable first-class + scaffolding
  - [x] Scaffolding (Makefile, vitest, package.json scripts, .gitignore, docker-compose container_name, README)
  - [x] Atomic-fs + write-lock + errors (libs + tests)
  - [x] signing-table parser/writer + fixtures + tests
  - [x] Refactor lib/opendkim.ts addDomain/removeDomain onto new writer
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
- 2026-04-14 — Atomic-fs, write-lock, and typed errors landed (7d7580b). 10 tests pass: atomic writes/overwrites/mode, tmp cleanup on rename failure, target untouched on write failure, lock serialisation on same path, concurrency across paths, rejection isolation, FIFO ordering.
- 2026-04-14 — SigningTable parser/writer/CRUD landed (a794cc5). 22 tests pass: round-trip identity for 9 fixtures, duplicate-id disambiguation, malformed-rule handling, CRUD preserves untouched lines, reorder carries leading blocks and keeps trailing at end, DuplicateEntryError/NotFoundError thrown per plan.
- 2026-04-14 — lib/opendkim.ts getDomains/addDomain/removeDomain now route SigningTable through the new writer (04e4b25). User-visible behaviour of Add Domain / Delete Domain unchanged; internal effect is round-trip safety (hand-edits survive).

## Decisions & Notes

- Branched from `dev`, not `main`, per user direction. PR will target `dev`.
- `.gitignore` had a stray trailing-newline delete in the working tree at start; discarded as incidental.
- Project uses **pnpm** (active lockfile). Shell aliases `npm` → `pnpm`. Makefile uses `npx` which resolves against either. No decision taken on removing the stale `package-lock.json`; left in place since it is unmaintained but not causing harm.
- **Plan divergence — ParsedSigningTable wrapper.** The plan's stated `parseSigningTable(content): SigningTableLine[]` signature cannot encode EOL + trailing-newline metadata without either side-channel state or synthetic list entries. The module instead exports `ParsedSigningTable { lines, eol, hasFinalNewline }`. CRUD functions still operate on `SigningTableLine[]` per the plan; only parse / serialize / saveSigningTable deal with the wrapper. API signatures downstream are unaffected.

## Blockers

_None._

## Commits

- `922cc5a` — docs: add pre-plan and plan for cross-domain SigningTable
- `3144a7a` — chore: init implementation tracker for signingtable-cross-domain
- `6c0cc21` — chore: move implementation tracker into docs/plans/
- `0c6267c` — chore: add Makefile, vitest, and test tooling scaffolding
- `270e1e9` — chore: codify single-instance deployment invariant
- `f56621a` — docs: update tracker — scaffolding complete
- `7d7580b` — feat: add atomic-fs, write-lock, and typed errors
- `a794cc5` — feat: add round-trip-safe SigningTable parser, writer, and CRUD
- `04e4b25` — refactor: route addDomain/removeDomain SigningTable writes through round-trip-safe writer
