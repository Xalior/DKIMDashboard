## Implementation: Cross-domain SigningTable entries in DKIM Dashboard

**Status:** In Progress
**Branch:** `feature/signingtable-cross-domain`
**Plan:** [plan_signingtable-cross-domain.md](plan_signingtable-cross-domain.md)
**Test plan (local, no live server):** [plan_signingtable-cross-domain_testplan.md](plan_signingtable-cross-domain_testplan.md)

## Tasks

- [ ] Phase 1: SigningTable first-class + scaffolding
  - [x] Scaffolding (Makefile, vitest, package.json scripts, .gitignore, docker-compose container_name, README)
  - [x] Atomic-fs + write-lock + errors (libs + tests)
  - [x] signing-table parser/writer + fixtures + tests
  - [x] Refactor lib/opendkim.ts addDomain/removeDomain onto new writer
  - [x] API routes /api/rules/signing + /api/rules/signing/[id] + tests
  - [x] UI routes /rules/signing, /rules/signing/new, /rules/signing/[id]
  - [x] Help surface (HelpModal, AboutThisPage, RowHelp, FieldTooltip + content)
  - [x] Navbar + /domains back-link
  - [x] Automated success criteria (`make test` 52 green, `make typecheck` clean, `make lint` clean, `make build` succeeds with all new routes registered)
  - [ ] Manual success criteria (**awaiting local verification on nancy** — see [testplan](plan_signingtable-cross-domain_testplan.md); live-server criteria from the plan are deferred since alpha will not be tested on a production host)
- [ ] Phase 2: KeyTable thin (read-only UI, round-trip writer) — re-review after Phase 1
  - [ ] **Followup (fold into Phase 2 scope):** retro-fit the 3-tier help surface onto `/domains` for consistency with `/rules/signing`. Less confusing page, so lower urgency, but the visual inconsistency is noticeable once the signing-rules pages ship. Reuses the existing `HelpModal` / `AboutThisPage` / `RowHelp` / `FieldTooltip` components; needs new content atoms only (e.g. `DomainsPageHelp`, `FromPatternHelp`, `SelectorHelp`).
- [ ] Phase 3: TrustedHosts first-class — re-review after Phase 2

## Progress Log

- 2026-04-14 — Branch created from `dev` at 3e391bf. Plan + pre-plan committed (922cc5a). Implementation tracker initialised.
- 2026-04-14 — Scaffolding landed: Makefile, vitest config + dev deps, .gitignore `.tmp.*` pattern (0c6267c); docker-compose container_name + README single-instance note (270e1e9). `make typecheck` and `make lint` both green against the pre-existing codebase.
- 2026-04-14 — Atomic-fs, write-lock, and typed errors landed (7d7580b). 10 tests pass: atomic writes/overwrites/mode, tmp cleanup on rename failure, target untouched on write failure, lock serialisation on same path, concurrency across paths, rejection isolation, FIFO ordering.
- 2026-04-14 — SigningTable parser/writer/CRUD landed (a794cc5). 22 tests pass: round-trip identity for 9 fixtures, duplicate-id disambiguation, malformed-rule handling, CRUD preserves untouched lines, reorder carries leading blocks and keeps trailing at end, DuplicateEntryError/NotFoundError thrown per plan.
- 2026-04-14 — lib/opendkim.ts getDomains/addDomain/removeDomain now route SigningTable through the new writer (04e4b25). User-visible behaviour of Add Domain / Delete Domain unchanged; internal effect is round-trip safety (hand-edits survive).
- 2026-04-14 — mutateSigningTable atomic RMW helper added (434e3c0); opendkim.ts callers rewired to use it so the read-and-write both run under the per-path lock.
- 2026-04-14 — API handlers landed (266d732): GET/POST/PATCH on /api/rules/signing, GET/PUT/DELETE on /api/rules/signing/[id], plus lib/api-errors.ts helper. 20 handler-level tests exercise happy paths and the full 400/404/409 matrix.
- 2026-04-14 — Help surface (57ce325): HelpModal, AboutThisPage, RowHelp, FieldTooltip + level-3 SigningRulesPageHelp and level-2 SigningRulesAtoms.
- 2026-04-14 — Signing Rules UI pages (28bdd27): list with reorder/delete, new-rule form, edit/delete [id] page. Navbar link + Domains back-link (0033a54).
- 2026-04-14 — **Phase 1 Automated Success Criteria all green.** 52 vitest tests, tsc --noEmit clean, eslint clean, next build succeeds with /rules/signing, /rules/signing/new, /rules/signing/[id], /api/rules/signing, /api/rules/signing/[id] all registered.

## Decisions & Notes

- Branched from `dev`, not `main`, per user direction. PR will target `dev`.
- `.gitignore` had a stray trailing-newline delete in the working tree at start; discarded as incidental.
- Project uses **pnpm** (active lockfile). Shell aliases `npm` → `pnpm`. Makefile uses `npx` which resolves against either. No decision taken on removing the stale `package-lock.json`; left in place since it is unmaintained but not causing harm.
- **Plan divergence — ParsedSigningTable wrapper.** The plan's stated `parseSigningTable(content): SigningTableLine[]` signature cannot encode EOL + trailing-newline metadata without either side-channel state or synthetic list entries. The module instead exports `ParsedSigningTable { lines, eol, hasFinalNewline }`. CRUD functions still operate on `SigningTableLine[]` per the plan; only parse / serialize / saveSigningTable deal with the wrapper. API signatures downstream are unaffected.
- **Phase 2 scope creep (accepted):** `/domains` page will gain the 3-tier help surface alongside the KeyTable work, so the dashboard's help language is consistent across Domains / Signing Rules / Keys after Phase 2 lands. Surfaced during Phase 1 local testing.

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
- `560e940` — docs: tracker — parser/writer, refactor, and 32 tests landed
- `434e3c0` — feat: add atomic read-modify-write helper for SigningTable
- `266d732` — feat: add /api/rules/signing and /api/rules/signing/[id] handlers
- `57ce325` — feat: add 3-tier help components and SigningRules content
- `28bdd27` — feat: add signing rules UI — list, add, edit/delete routes
- `0033a54` — feat: wire Signing Rules into Navbar and add Domains back-link
