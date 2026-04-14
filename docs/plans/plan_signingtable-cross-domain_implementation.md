## Implementation: Cross-domain SigningTable entries in DKIM Dashboard

**Status:** Phase 1 merged into `dev` (PR #4). Phase 2 in progress on `feature/keytable-thin`.
**Branch:** `feature/keytable-thin` (current) — Phase 1 shipped via `feature/signingtable-cross-domain` (deleted)
**Plan:** [plan_signingtable-cross-domain.md](plan_signingtable-cross-domain.md)
**Test plans (local, no live server):**
- Phase 1: [plan_signingtable-cross-domain_testplan.md](plan_signingtable-cross-domain_testplan.md)
- Phase 2: [plan_signingtable-cross-domain_testplan_phase2.md](plan_signingtable-cross-domain_testplan_phase2.md)

## Tasks

- [x] Phase 1: SigningTable first-class + scaffolding — **complete**
  - [x] Scaffolding (Makefile, vitest, package.json scripts, .gitignore, docker-compose container_name, README)
  - [x] Atomic-fs + write-lock + errors (libs + tests)
  - [x] signing-table parser/writer + fixtures + tests
  - [x] Refactor lib/opendkim.ts addDomain/removeDomain onto new writer
  - [x] API routes /api/rules/signing + /api/rules/signing/[id] + tests
  - [x] UI routes /rules/signing, /rules/signing/new, /rules/signing/[id]
  - [x] Help surface (HelpModal, AboutThisPage, RowHelp, FieldTooltip + content)
  - [x] Navbar + /domains back-link
  - [x] Automated success criteria (`make test` 52 green, `make typecheck` clean, `make lint` clean, `make build` succeeds with all new routes registered)
  - [x] Manual success criteria — all non-optional sections signed off on nancy via [testplan](plan_signingtable-cross-domain_testplan.md). Live-server criteria from the plan (real mail + DNS + `dkim=pass` verification, mid-write container kill) remain deferred as agreed — alpha is not being tested on a production host.
- [ ] Phase 2: KeyTable thin — code complete on `feature/keytable-thin`, awaiting local manual verification
  - [x] `lib/key-table.ts` + fixtures + tests (mirrors signing-table's shape, including the `ParsedKeyTable` wrapper for EOL / trailing-newline preservation)
  - [x] `mutateKeyTable` atomic read-modify-write helper (matches `mutateSigningTable` from Phase 1)
  - [x] Refactor `lib/opendkim.ts` addDomain / removeDomain KeyTable paths through the new writer
  - [x] `GET /api/rules/keys` and `GET /api/rules/keys/[id]` (read-only — R/W editor deferred per plan)
  - [x] Rewrite `app/keys/page.tsx` against the new endpoint, with "non-standard entry" badges for malformed rows
  - [x] New `app/rules/keys/[id]/page.tsx` read-only detail (disk files + expected DNS + live DNS verification for canonical; raw-line + explanation for malformed)
  - [x] Remove `app/api/keys/route.ts`
  - [x] Navbar: active state covers `/rules/keys/[id]` under the Keys link
  - [x] Help content — `KeyEntriesPageHelp` + `KeyEntriesAtoms`
  - [x] **Extra A:** `/domains` 3-tier help retrofit — `DomainsPageHelp` + `DomainsAtoms` (DomainFieldHelp, FromPatternHelp, SelectorFieldHelp, DnsStatusHelp). Column headers + Add-Domain form fields now carry `[?]` + tooltip.
  - [x] **Extra B:** narrow Delete Domain — `DomainEntry.id`, `removeDomain(…, ruleId?)`, `/api/domains` DELETE accepts `ruleId`, `/domains` UI passes it, confirmation copy rewritten ("Remove signing rule", explains key retention + no-auto-delete of key files).
  - [x] Automated success criteria — `make ci` passes: 76 tests across 8 files, tsc clean, eslint clean, next build succeeds with new routes registered and `/api/keys` gone.
  - [ ] Manual success criteria — see [Phase 2 testplan](plan_signingtable-cross-domain_testplan_phase2.md)
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
- 2026-04-14 — **Phase 1 Manual criteria complete on nancy.** Walkthrough covered baseline render, canonical + cross-domain add, edit-with-new-id, deep-link, reorder (file reflects byte-for-byte), hand-edit comment preservation across add/delete, 409 duplicate guard, 400 validation, 3-tier help (About/[?]/tooltip), back-compat via `/domains` Add Domain / Delete Domain, and the behavioural single-instance check (`docker compose up --scale dkim-dashboard=2` produced the documented `container_name` refusal). Optional sections 15 (atomicity chmod variant) are skipped. Phase 1 is signed off.
- 2026-04-14 — **PR #4 merged to dev.** Phase 1 branch deleted. Phase 2 branched off fresh dev as `feature/keytable-thin`.
- 2026-04-14 — **Phase 2 re-review complete.** Scope agreed: plan verbatim + two extras (Domains help retrofit + narrow Delete Domain) in a single batch / single PR.
- 2026-04-14 — **Phase 2 code complete** on `feature/keytable-thin`. Commits: key-table lib + 18 tests (1cd52c3), opendkim refactor w/ narrow-delete (bf6f79e), keys API read-only (f4428d1), /keys rewrite + detail page (2c19eca), /domains retrofit + narrow-delete wiring (5ddb219). `make ci` green: 76 tests, clean tsc + eslint, build succeeds. Awaiting manual walkthrough on nancy before PR.

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
