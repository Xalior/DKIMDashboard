## Implementation: Cross-domain SigningTable entries in DKIM Dashboard

**Status:** Phase 1 merged into `dev` (PR #4). Phase 2 merged into `dev` (PR #5). Phase 3 in progress on `feature/trustedhosts-first-class`.
**Branch:** `feature/trustedhosts-first-class` (current). Prior branches merged + deleted: `feature/signingtable-cross-domain`, `feature/keytable-thin`.
**Plan:** [plan_signingtable-cross-domain.md](plan_signingtable-cross-domain.md)
**Test plans (local, no live server):**
- Phase 1: [plan_signingtable-cross-domain_testplan.md](plan_signingtable-cross-domain_testplan.md)
- Phase 2: [plan_signingtable-cross-domain_testplan_phase2.md](plan_signingtable-cross-domain_testplan_phase2.md)
- Phase 3: [plan_signingtable-cross-domain_testplan_phase3.md](plan_signingtable-cross-domain_testplan_phase3.md)

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
- [ ] Phase 3: TrustedHosts first-class — code complete on `feature/trustedhosts-first-class`, awaiting local manual verification
  - [x] `lib/trusted-hosts.ts` + fixtures + tests (mirrors signing-table's shape minus reorder; inline-comment handling is the novel piece)
  - [x] `mutateTrustedHosts` atomic read-modify-write helper
  - [x] `lib/opendkim.ts` — `saveTrustedHosts(string[])` removed entirely; legacy `parseTrustedHosts` retained as a thin wrapper
  - [x] Rewrite `app/api/trusted-hosts/route.ts` — `GET` (list) + `POST` (add). Bulk `PUT` dirty-flag save removed.
  - [x] New `app/api/trusted-hosts/[id]/route.ts` — `GET` / `PUT` / `DELETE`
  - [x] Rewrite `app/trusted-hosts/page.tsx` — per-row Edit / Delete, Add button links to `/trusted-hosts/new`
  - [x] New `app/trusted-hosts/new/page.tsx` and `app/trusted-hosts/[id]/page.tsx` (deep-linkable)
  - [x] Help — `TrustedHostsPageHelp` + `TrustedHostsAtoms` (IpHelp, CidrHelp, HostnameHelp, InlineCommentHelp). `RefileDirectiveHelp` re-exported from `SigningRulesAtoms` per plan's DRY note.
  - [x] **Plan deviation — inline comments survive edit.** `updateEntry` defaults to preserving the existing inline comment; caller can pass `inlineComment: ''` to drop or a new string to replace. Three dedicated unit tests + matching API handler tests.
  - [x] Automated success criteria — `make ci` passes: 111 tests across 11 files, tsc clean, eslint clean, next build succeeds with all new routes registered.
  - [ ] Manual success criteria — see [Phase 3 testplan](plan_signingtable-cross-domain_testplan_phase3.md)
- [ ] Phase 4 (future, pre-plan mode) — scope larger than a single vertical slice; enters `/preplan` when we start it
  - KeyTable R/W editor — individual key-entry add/edit/delete UI. Deferred from Phase 2 per plan's own explicit gate.
  - DKIM debugging UI for onboarding fresh + elsewhere-hosted domains. Scope TBD; likely touches DNS lookup ergonomics, live signature verification, key-vs-record diff views.
  - **Comment & disabled-entry UX across all three tables.** Today the parser treats every `#`-prefixed line as part of a leading/trailing preamble block — attached invisibly to the entry that follows it. This preserves hand-edits on disk but hides them from operators using the UI. Phase 4 should surface comments and handle the "disable but keep" pattern explicitly:
    - **Prose comments (blocks + trailing):** render leading/trailing comment blocks as read-only, non-interactive muted rows next to the entry they're attached to (or standalone at file end). No edit controls; operators edit `.conf`-style notes by hand — consistent with the "hand-edits survive" story.
    - **Commented-out entries (disabled entries):** a distinct concept. A comment line whose body parses as a valid entry (e.g. `# 10.0.0.0/8`, `#*@deprecated.com mail._domainkey.x`) is a deliberate "disable but keep for later" marker, not prose. Model it as an `{ kind: 'entry-disabled' }` variant (or an `enabled: boolean` flag on `entry`), with UI affordances: a **disabled** badge, grey-out styling, and a toggle to re-enable (which re-writes the line un-commented). Serialize as `# ${value}…` in canonical form for disabled state.
    - **Round-trip fidelity stays paramount.** A prose comment that *happens* to parse as an entry shouldn't get auto-coerced into a disabled-entry on write — the parser needs a heuristic (e.g. only treat a commented entry as disabled if the next non-comment line is also an entry, or require a sentinel like `# disabled: `), and any edit / re-enable action needs explicit user intent.
    - **Applies to all three tables** — SigningTable rules, KeyTable entries, TrustedHosts entries. Plus the delete-preview modals should render the leading block that's about to vanish so operators see what they're losing.
  - **Full test-suite rollout** — the three phases of this plan have covered lib + API handler tests via vitest. The UI layer (pages, forms, modals, help surface wiring) currently has no automated coverage; Phase 4 should fold in a browser / component test layer (e.g. Playwright or @testing-library/react) alongside the feature work so the UI stops being a manual-only check.
    - **Concrete edge cases uncovered during Phases 1–3 that need regression coverage** (bundle these into the Phase 4 pre-plan scope so nothing is forgotten):
      - **Inline-comment UI normalisation (Phase 3).** Storage keeps a leading `#`; the UI strips it for display/input. Test: a round-trip through the edit form on an entry with `# foo` leaves on-disk bytes identical and never produces `## foo`.
      - **Inline-comment preserve-on-edit through the form (Phase 3 deviation).** Unit tests cover the lib + API contracts. Missing: a UI-level test that editing only the value field and saving preserves the inline comment as expected; editing with the comment field cleared drops it; editing with new comment text replaces it. Today this is only verified by the manual testplan.
      - **TrustedHosts value-with-whitespace parser case (Phase 3 fix).** Regression-covered in `lib/trusted-hosts.test.ts`. Keep this test; don't let it regress if the parser gets reshaped.
      - **Server-side whitespace / comma rejection on TrustedHosts POST+PUT.** Handler tests exist. Add matching UI-level tests that the HTML `pattern="[^\s,]+"` blocks the form from submitting invalid input client-side.
      - **Narrow-delete via `/api/domains` DELETE with `ruleId` (Phase 2 Extra B).** Tested indirectly via handler integration. Missing: a focused unit test on `removeDomain(domain, selector, ruleId?)` itself — both the narrow path (other rules referencing same selectorDomain → KeyTable entry preserved) and the last-reference path (KeyTable entry removed, key files untouched).
      - **One-of-many rules sharing a keyRef.** `/domains` lists one row per signing rule; deleting one should not cascade. UI test: seed two rules for the same (domain, selector), delete one via the `/domains` UI, assert the other row + the KeyTable entry + key files persist.
      - **Round-trip through the write path (not just the parser).** Hand-edit a comment into SigningTable / KeyTable / TrustedHosts on disk, run a sequence of UI CRUD actions, assert the hand-edit survives. Today this is the most compelling test; it exists only in the manual testplans.
      - **Deep-link stale-id UX.** Edit a rule/entry (new id generated); open the old URL in a new tab. The "not found" page renders with a back link. Component test for all three [id] pages (signing / keys / trusted-hosts).
      - **Concurrent-edit 404 handling.** When a PUT returns 404 (entry removed in another tab), the edit page transitions to the "not found" state instead of propagating an error toast. Component test for `/rules/signing/[id]` and `/trusted-hosts/[id]`.
      - **Duplicate guard surfacing in UI.** API returns 409 on duplicate; the UI keeps the form populated and shows a dismissible `Alert` with the error message. No silent redirect. Covered manually; needs a component test.
      - **Reorder optimistic local update then server reconciliation (Phase 1).** The `/rules/signing` list updates local state optimistically and PATCHes the server; server reply is source of truth. Component test: simulate a conflict response and assert the UI surfaces the alert rather than silently rolling back.
      - **Help surface rendering.** Every page-level "About this page" modal and every row `[?]` opens, renders its expected copy, and closes on Esc / close-button. No modal content has a test today.
      - **`aria-describedby` wiring on form inputs.** Every `FieldTooltip`-wrapped input has the right `aria-describedby` attribute pointing at a visible tooltip ID. Component-level test with jsdom is sufficient.
      - **Malformed-KeyTable surfacing (Phase 2).** A KeyTable line with `selectorDomain ` followed by a malformed value side must show as a "non-standard entry" row, no Regenerate button, and its `/rules/keys/[id]` detail page shows only the raw-line card. Handler tests exist; UI render tests do not.
      - **Add-Domain regenerates-on-collision (pre-existing dashboard behaviour).** Adding a domain with an existing `(domain, selector)` silently regenerates the private key and clobbers the `.txt` file — flagged as a pre-existing bug during Phase 2 testing and explicitly out-of-scope for that phase. Phase 4 should decide whether to fix this (confirmation prompt before overwrite) and add a regression test either way.
  - Start with `/preplan` to shape goal + scope before writing an implementation plan.

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
- 2026-04-14 — **Phase 2 merged into `dev`** (PR #5). Branch deleted; `feature/trustedhosts-first-class` branched off the merged dev.
- 2026-04-14 — **Phase 3 code complete** on `feature/trustedhosts-first-class`. Commits: tracker scope lock (ac9f43e), trusted-hosts lib + 19 tests + Phase 4 test-suite note (6984a2c), API rewrite + [id] route + 16 handler tests (56d678e), UI pages + help content + navbar pass-through (2ab70b5). `make ci` green: 111 tests across 11 files, clean tsc + eslint, `next build` registers `/api/trusted-hosts/[id]`, `/trusted-hosts/[id]`, `/trusted-hosts/new`. Awaiting manual walkthrough on lucy before PR.

## Decisions & Notes

- Branched from `dev`, not `main`, per user direction. PR will target `dev`.
- `.gitignore` had a stray trailing-newline delete in the working tree at start; discarded as incidental.
- Project uses **pnpm** (active lockfile). Shell aliases `npm` → `pnpm`. Makefile uses `npx` which resolves against either. No decision taken on removing the stale `package-lock.json`; left in place since it is unmaintained but not causing harm.
- **Plan divergence — ParsedSigningTable wrapper.** The plan's stated `parseSigningTable(content): SigningTableLine[]` signature cannot encode EOL + trailing-newline metadata without either side-channel state or synthetic list entries. The module instead exports `ParsedSigningTable { lines, eol, hasFinalNewline }`. CRUD functions still operate on `SigningTableLine[]` per the plan; only parse / serialize / saveSigningTable deal with the wrapper. API signatures downstream are unaffected.
- **Phase 2 scope creep (accepted):** `/domains` page will gain the 3-tier help surface alongside the KeyTable work, so the dashboard's help language is consistent across Domains / Signing Rules / Keys after Phase 2 lands. Surfaced during Phase 1 local testing.
- **Phase 3 inline-comment deviation from plan (2026-04-14).** The plan said inline trailing comments should be dropped when an entry is edited, in favour of a simpler canonical form. Overridden at re-review: inline comments can carry important operator context and must survive edits. The edited-entry canonical form becomes `${value} ${inlineComment}\n` whenever an inline comment is present. `InlineCommentHelp` copy will reflect the preserve-on-edit behaviour rather than warning about drop-on-edit.
- **Phase 4 reserved for pre-plan (2026-04-14).** KeyTable R/W editor + DKIM debugging UI (fresh / elsewhere-hosted domain onboarding) are bundled into a future Phase 4. Scope is too wide to plan directly — must enter `/preplan` to shape goal + scope first.

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
