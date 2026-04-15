# Plan: Cross-domain SigningTable entries in DKIM Dashboard

**Status:** Ready for implementation
**Pre-plan:** [docs/plans/preplan_signingtable-cross-domain.md](preplan_signingtable-cross-domain.md)

## Overview

Make signing rules, key entries, and trusted hosts first-class concepts in the DKIM Dashboard — parseable and writeable without losing arbitrary hand-edited content. Originating driver: the smarthost pattern (`*@ursa.xalior.com  mail._domainkey.clientmail.xalior.com`), which cannot be added via the current UI and is not safe to hand-edit because the current writer substring-filters on remove and fully reconstructs TrustedHosts.

Delivered as three vertical-slice PRs, each shipping behaviour + help together. Phase 2 is a deliberate exception to "fully-functional bottom-to-top" — it ships parser/writer safety with a read-only surfacing, and the shape of its R/W successor is deferred to a post-Phase-2 review.

## Current State

- Config lives in `/etc/opendkim.conf`, `/etc/opendkim/SigningTable`, `/etc/opendkim/KeyTable`, `/etc/opendkim/TrustedHosts`. Dashboard mounts these via `OPENDKIM_CONFIG_DIR`.
- [`lib/opendkim.ts`](../../lib/opendkim.ts) parses and writes all three tables:
  - SigningTable parsed at [lib/opendkim.ts:37-46](../../lib/opendkim.ts#L37-L46) — `{ pattern, selectorDomain }` per non-comment line. Written in two paths: `addDomain` appends ([lib/opendkim.ts:180-185](../../lib/opendkim.ts#L180-L185)); `removeDomain` filters by substring-match on selectorDomain ([lib/opendkim.ts:203-209](../../lib/opendkim.ts#L203-L209)). Non-matching lines survive; trailing newline is lost.
  - KeyTable parsed at [lib/opendkim.ts:48-64](../../lib/opendkim.ts#L48-L64); appended at [lib/opendkim.ts:187-194](../../lib/opendkim.ts#L187-L194); filtered at [lib/opendkim.ts:211-218](../../lib/opendkim.ts#L211-L218). Same shape assumptions and trailing-newline bug.
  - TrustedHosts parsed at [lib/opendkim.ts:66-72](../../lib/opendkim.ts#L66-L72); written via full overwrite at [lib/opendkim.ts:221-224](../../lib/opendkim.ts#L221-L224). Comments stripped on parse; anything non-hostname discarded on save.
- Data model: `DomainEntry` ([lib/opendkim.ts:23-29](../../lib/opendkim.ts#L23-L29)) bundles pattern + selectorDomain + domain + selector + keyPath into one unit. No separate rule concept. `getDomains()` ([lib/opendkim.ts:92-107](../../lib/opendkim.ts#L92-L107)) merges SigningTable and KeyTable by `selectorDomain`; orphan SigningTable entries (no matching KeyTable entry) surface with empty `domain/selector/keyPath` fields.
- UI: 5 client-component pages under `app/` — `/`, `/domains`, `/keys`, `/trusted-hosts`, `/config`. No URL state anywhere; all edit state is ephemeral component state. Modals inline per-page (no reusable Modal). React-Bootstrap 2.10.10 over Bootstrap 5.3.8.
- Stack: Next.js 16.2.2 (App Router), React 19.2.4, TypeScript strict, npm. No test framework. No Makefile.

## Desired End State

- A **signing rule** is a first-class tuple `(match-pattern, selector._domainkey.domain)` addressable on its own route (`/rules/signing/[id]`). Users can add, edit, remove, and reorder rules — including non-canonical shapes (glob, cross-domain mapping, `refile:`). Existing Add-Domain flow remains the default user path and continues to produce its 1:1 rule automatically.
- A **key entry** is a first-class tuple `(selector._domainkey.domain, domain:selector:keyPath)` whose existence and shape survives read-modify-write cycles regardless of the dashboard's opinion of its shape. After Phase 2, the UI lists these read-only; the R/W editor is a separate PR whose shape is designed after Phase 2 ships.
- A **trusted host** entry is a first-class item on its own route (`/trusted-hosts/[id]`). Comments, `refile:` directives, inline comments survive round-trip.
- **Help** ships with each phase in three tiers: page-scoped "About this page" modal (level-3), row-level `[?]` modal (level-2), field tooltips (ARIA-accessible).
- **Tests** exercise parser round-trip (for every changed table, property: read → write → bytes equal given no mutations) plus CRUD-preserves-unchanged-lines semantics.
- `make lint`, `make typecheck`, `make test`, `make build` drive CI-style checks locally.

## Key Discoveries

- **Round-trip failure concentrates in TrustedHosts, not SigningTable.** `saveTrustedHosts` is full overwrite from a stripped-comment model ([lib/opendkim.ts:221-224](../../lib/opendkim.ts#L221-L224)). SigningTable/KeyTable `addDomain` are append-only and `removeDomain` substring-filters — so non-canonical lines like `*@*.xalior.com mail._domainkey.clientmail.xalior.com` actually survive today. The real failure is that the UI *model* has no way to express such a rule for editing.
- **Orphan entries already surface weirdly.** `getDomains()` merges by `selectorDomain`; a SigningTable rule whose selector doesn't match a KeyTable key produces a `DomainEntry` with empty `domain/selector/keyPath` ([lib/opendkim.ts:102-104](../../lib/opendkim.ts#L102-L104)). Second class of user-visible data the current UI handles poorly.
- **No test framework exists.** Round-trip safety is a property-level claim; cannot be made credibly without tests. Phase 1 bundles vitest setup.
- **No URL state anywhere.** Deep-linkable edit state per the concept section means introducing route segments (`[id]`) — a cross-cutting addition that first lands in Phase 1.
- **Ordering is semantically required for SigningTable, not KeyTable.** OpenDKIM first-match-wins on SigningTable. KeyTable is a lookup map; order is cosmetic. Ordering UI is Phase 1 only.
- **`removeDomain` has a trailing-newline bug.** `split('\n').join('\n')` drops the terminal empty string. Fixed incidentally by Phase 1's round-trip writer.

## What We're NOT Doing

- Per-DNS-provider help (Cloudflare / Route53 / GoDaddy / etc. specific copy). Generic integration help only.
- Authentication / authorization inside the dashboard. Edge ingress remains the gate.
- DMARC / SPF record management.
- Key rotation / scheduled regeneration.
- i18n of help content. English only.
- Change history / audit log of edits.
- Dedicated import flow for existing non-canonical installs. The Phase-1 parser reads them correctly on next deploy.
- **Full R/W editor for KeyTable entries.** Deferred explicitly to a post-Phase-2 design conversation.
- Refactoring of Add Domain / Regenerate Key / Delete Domain flows beyond what's needed to wire them to the new rule/key model. User-visible behaviour of those flows is unchanged.
- CI pipeline (GitHub Actions job). `make ci` is defined locally; hooking it into CI is outside the dashboard itself.
- Cross-process / cross-container write locking (`flock`-style filesystem locks). The deploy is single-container; intra-process mutex suffices. Revisit if and when a multi-writer shape is introduced.
- Versioning / history of config changes. Intended future direction is explicitly "internally-managed git repo rooted at the config directory, commit after each successful write" — see the Atomic writes decision in Approach. Not built in this plan; forward-compatibility is preserved.

## Invariants

These are hard project invariants that the rest of the plan relies on. Breaking any of them requires going back to the pre-plan, not just revising this plan.

- **Single-instance container.** The dashboard is deployed as exactly one running container per mounted `/etc/opendkim` config tree. This invariant is what allows an in-process async mutex to be a complete concurrency solution — multi-instance would require filesystem-level (`flock`) locking that is out of scope. Enforced in [docker-compose.yml](../../docker-compose.yml) via `container_name: dkim-dashboard` (Compose refuses to scale any service with a fixed container name); documented in [README.md](../../README.md) so operators deploying outside Compose (raw Docker, Kubernetes, etc.) know not to run replicas.

## Approach

Each phase is a vertical slice: parser → writer → API → page(s) → help — shipping a usable PR.

**Phase 1** bundles a one-time tool-chain addition (Makefile + vitest) because its automated success criteria depend on both. That piece is a horizontal intrusion, named here rather than hidden.

**Phase 2** is intentionally a *safety* slice rather than a *feature* slice — it delivers round-trip correctness with a read-only view, and the shape of its R/W successor is deferred to a post-Phase-2 design review.

**Phase 3** is provisionally full CRUD modelled on Phase 1; its final shape is formally re-confirmed after the Phase-2 review.

**Review gates (provisional downstream phases).** Phase 2 and Phase 3 are planned in full below so the intent and shape are visible up front, but both are **explicitly provisional**: their detail is open to revision based on what actually emerges during the preceding phase. Phase 2 is re-reviewed after Phase 1 lands (the lessons from building the first parser/writer inform how KeyTable's treatment should differ, if at all). Phase 3 is re-reviewed after Phase 2 lands (the separate R/W-shape conversation for KeyTable may shift what "full CRUD modelled on Phase 1" should look like for TrustedHosts). The planned detail is therefore a starting point for each downstream review, not a contract to deliver verbatim.

**Cross-cutting design decisions** applied consistently across phases:

- **Rule / entry IDs** = `base64url(sha256(canonical-content-string)).slice(0,12)`, with `-N` suffix appended on duplicates in parse order. Deterministic across server restarts. Edits change the id (URLs 404 — honest about what changed). If the bookmark-stability concern becomes real later, upgrade to a persisted sidecar without changing the public URL shape.
- **Preservation model** ("leading block" anchoring): every non-rule/non-entry block (comments, blank lines, unparseable junk) is attached to the rule/entry immediately below it as a `leading` property. On reorder the block travels with its owner; on delete it disappears with it; content after the last rule lives in a single `trailing` entry preserved at file end. Alternative models (positional anchoring, adjacency to rule above) are rejected because reorder semantics get confusing.
- **Writer strategy**: every parsed line carries a `rawLine`. Serializer emits `rawLine` verbatim when untouched; emits canonical form when mutated or newly added. Property: `serialize(parse(f)) === f` byte-for-byte for every fixture. This is the foundation of round-trip safety.
- **Canonical serialization forms** (used for new / mutated entries):
  - SigningTable: `${pattern} ${keyRef}\n` (single space)
  - KeyTable: `${selectorDomain} ${domain}:${selector}:${keyPath}\n`
  - TrustedHosts: `${value}\n`
- **Deep-linkable edit state** via route segments (`/rules/signing/[id]`, `/rules/keys/[id]`, `/trusted-hosts/[id]`). No `useSearchParams`-as-URL-state shortcuts.
- **Atomic writes + in-process mutex.** Every config write goes through `writeFileAtomic(path, content)` — write to `path.tmp.<pid>.<rand>` in the same directory, then `rename()`. `rename(2)` on the same filesystem is atomic at the kernel level, so a killed process cannot leave a half-written file. A per-path async mutex wraps each read-modify-write cycle so concurrent requests in the same Node process serialise rather than last-writer-wins. Together these address partial-write-on-crash *and* intra-process concurrency for the single-container deploy. Cross-process / cross-container writers (e.g. `flock`-style filesystem locks) are out of scope because single-container is a hard invariant (see Invariants section). **Forward compatibility with internally-managed git versioning** is an explicit design goal: the chosen future versioning direction is an internally-managed git repo rooted at the config directory, with a commit issued after each successful atomic rename. Nothing in the Phase-1 design precludes this: tmp files follow a `.tmp.*` pattern that can be added to `.gitignore`; write paths are already synchronous from the caller's perspective so a post-write `git add && git commit -m "…"` slots in without restructuring.
- **Duplicate enforcement.** Writers reject duplicate content with a typed `DuplicateEntryError`. API layer maps this to HTTP 409. UI surfaces it as a red dismissible Bootstrap `Alert` on the originating page (same visual language as existing success / error alerts throughout the app). Duplicate rules / entries should never exist in the file after a successful UI action — silently creating duplicates (as naive `addRule` on identical content would) is a footgun because OpenDKIM accepts duplicates but the first match wins, so a later identical entry becomes dead code and confuses the admin.
- **Error surfacing in UI.** All API error responses (400, 404, 409, 500) surface to the user via a dismissible `Alert` with the server's error message, matching the pattern at [app/domains/page.tsx:141-147](../../app/domains/page.tsx) and other pages. No silent failures, no raw `console.error` swallowing.

## Phase 1: SigningTable first-class + scaffolding

### Overview

Make signing rules the primary data model for SigningTable entries. Parser captures every line faithfully (rules, comments, blanks, unparseable junk); writer emits original bytes for untouched lines and canonical form for new or edited lines. New REST surface under `/api/rules/signing` with per-id resources. New UI routes under `/rules/signing` with deep-linkable edit (`/rules/signing/[id]`) and user-driven reordering (first-match-wins matters). Existing Add Domain flow is rewired onto this model — continues to produce its 1:1 rule side-effect as today, user-visible behaviour unchanged. Help ships in three tiers.

One-time tool-chain additions: Makefile and vitest, because Phase 1's automated success criteria depend on both.

### Changes Required

#### Scaffolding

1. **`Makefile`** (new). Targets: `dev`, `build`, `lint`, `typecheck`, `test`, `ci`. `typecheck` = `npx tsc --noEmit`. `test` = `npx vitest run`. `lint` = `npx eslint .`. `ci` chains `lint → typecheck → test → build`.
2. **`package.json`**: add dev deps `vitest`, `@vitest/ui`. Add scripts `test` (`vitest run`), `test:watch` (`vitest`), `typecheck` (`tsc --noEmit`). Keep existing `dev`, `build`, `start`, `lint`.
3. **`vitest.config.ts`** (new): node environment; test globs `lib/**/*.test.ts` and `app/**/*.test.ts`.
4. **`.gitignore`**: ensure `coverage/` is ignored (add if absent). Also add `.tmp.*` pattern globally (used by `writeFileAtomic`) so future tooling won't sweep them up.
4f. **[docker-compose.yml](../../docker-compose.yml)**: add `container_name: dkim-dashboard` to the `dkim-dashboard` service. Compose refuses `docker compose up --scale dkim-dashboard=N` when `container_name` is set — this is the enforcement mechanism for the single-instance invariant. Add an inline comment naming it explicitly.
4g. **[README.md](../../README.md)**: add a short "Deployment constraint: single instance" note to the Production Deployment section. Operators deploying outside Compose (raw Docker, Kubernetes, etc.) need to know not to run replicas against the same `/etc/opendkim` mount.

#### Atomic writes & concurrency primitives

These modules are introduced in Phase 1 and re-used by Phases 2 and 3.

4a. **`lib/atomic-fs.ts`** (new). Exports:
   - `writeFileAtomic(path: string, content: string | Buffer, options?: { mode?: number }): Promise<void>` — writes to `${dirname(path)}/.${basename(path)}.tmp.${pid}.${rand}`, then `rename()` to `path`. Uses same-directory tmp so rename is always cross-fs-safe. Applies `mode` via `chmod` after write, before rename. On failure, attempts to clean the tmp file; swallowing cleanup errors is acceptable (the caller has already failed).

4b. **`lib/write-lock.ts`** (new). Exports:
   - `withLock<T>(path: string, fn: () => Promise<T>): Promise<T>` — module-level `Map<string, Promise<void>>` holds a tail promise per path. Each call chains `fn` onto the tail; returns `fn`'s result. Simple, no external dependency. Equivalent hand-rolled mutex; if the team prefers, swap for `async-mutex` (small, well-known) — implementer's call, noted here as an equivalent alternative.

4c. **`lib/errors.ts`** (new). Exports:
   - `class DuplicateEntryError extends Error` — `{ code: 'DUPLICATE_ENTRY'; kind: 'signing-rule' | 'key-entry' | 'trusted-host'; value: string }`. Thrown by writer modules when a duplicate content addition is attempted.
   - `class NotFoundError extends Error` — `{ code: 'NOT_FOUND'; id: string }`. Thrown when `[id]` routes or writers are handed an id that doesn't resolve.

4d. **`lib/atomic-fs.test.ts`** (new). Properties:
   - Writes are visible at the target path only after `rename`.
   - On `writeFile` throwing mid-way, the target path is untouched.
   - Tmp file is cleaned on both success and caught failure.

4e. **`lib/write-lock.test.ts`** (new). Properties:
   - Two concurrent `withLock(path, fn)` calls execute serially (second starts only after first resolves).
   - Different paths execute concurrently.
   - A rejection in one task doesn't poison the queue for later tasks.

#### Data model & parser/writer

5. **`lib/signing-table.ts`** (new). Exported types and functions:
   - `type PreambleLine = { content: string; kind: 'comment' | 'blank' | 'other' }`.
   - `type SigningTableLine` discriminated union: `{ kind: 'rule'; id: string; pattern: string; keyRef: string; rawLine?: string; leading: PreambleLine[] }` | `{ kind: 'trailing'; lines: PreambleLine[] }`.
   - `type SigningRule = { id: string; pattern: string; keyRef: string }` — consumer-facing projection.
   - `parseSigningTable(content: string): SigningTableLine[]`.
   - `serializeSigningTable(lines: SigningTableLine[]): string`.
   - `listRules(lines: SigningTableLine[]): SigningRule[]`.
   - `addRule(lines, { pattern, keyRef, position? }): SigningTableLine[]` — throws `DuplicateEntryError` if a rule with the same `(pattern, keyRef)` already exists in `lines`.
   - `updateRule(lines, id, { pattern, keyRef }): SigningTableLine[]` — throws `NotFoundError` on missing id; throws `DuplicateEntryError` if the proposed new content collides with a *different* existing rule.
   - `removeRule(lines, id): SigningTableLine[]` — throws `NotFoundError` on missing id.
   - `reorderRules(lines, idList: string[]): SigningTableLine[]` — rearranges rule entries per `idList`; trailing entry stays at end; leading blocks travel with their rules. Throws if `idList` doesn't contain exactly every current rule id.
   - `saveSigningTable(lines: SigningTableLine[]): Promise<void>` — serialises lines and writes via `withLock(signingPath, () => writeFileAtomic(signingPath, serialized))`. This is the only supported write path. API handlers and `lib/opendkim.ts` refactors call this.

   Behavioural details:
   - ID = `base64url(sha256(pattern + '\0' + keyRef)).slice(0,12)`. Since duplicate `(pattern, keyRef)` is now a hard error, the `-2`/`-3` disambiguator only applies when a **pre-existing** file already has duplicate lines (legacy data). New writes can never introduce duplicates.
   - Comment / blank line detection on parse: comment = trimmed-starts-with `#`; blank = trimmed empty.
   - Malformed line (single token after trim, or zero tokens after strip) is retained as `{ kind: 'rule'; pattern: <firstToken>; keyRef: '' }` with a sentinel — the UI can display it with a "malformed" badge. Round-trip-safe via `rawLine`.
   - `updateRule` clears `rawLine` (forces canonical re-emit).
   - Final newline preservation: `serializeSigningTable` reproduces whether the input file ended in `\n`.

6. **`lib/signing-table.test.ts`** (new). Tests (each a separate `it()`):
   - `serialize(parse(f)) === f` for every fixture (byte-for-byte).
   - `addRule(parse(f), { pattern, keyRef })` then serialize: all original lines present verbatim; new rule appended with canonical form.
   - `updateRule(...)` changes only the target line.
   - `removeRule(...)` removes target rule and its leading block; all other lines unchanged.
   - `reorderRules(...)` moves rules in `idList` order; leading blocks follow; trailing block stays at end.
   - Duplicate-content rules produce unique ids (`-2`, `-3` suffix).
   - CRLF input: detected on parse, preserved on serialize.
   - No-trailing-newline input: preserved on serialize.

7. **`lib/__fixtures__/signing-table/`** (new dir). Files:
   - `canonical.txt` — single canonical rule matching the current ursa production content.
   - `with-comments.txt` — canonical rule preceded by `#` comment and blank line.
   - `glob.txt` — `*@*.xalior.com  mail._domainkey.clientmail.xalior.com`.
   - `cross-domain.txt` — `*@ursa.xalior.com  mail._domainkey.clientmail.xalior.com` plus canonical rule.
   - `refile.txt` — `refile:/etc/opendkim/CustomRules` (retained as malformed rule, round-trip-safe).
   - `mixed.txt` — combination of all of the above with interleaved comments.
   - `crlf.txt` — CRLF line endings.
   - `empty.txt` — empty string.
   - `no-trailing-newline.txt` — content without final `\n`.

8. **`lib/opendkim.ts`** refactor:
   - `getDomains` ([lib/opendkim.ts:92-107](../../lib/opendkim.ts#L92-L107)): replace `parseSigningTable(signingRaw)` with `listRules(parseSigningTable_v2(signingRaw))` (imported from `./signing-table`). Semantically equivalent for canonical inputs.
   - `addDomain` ([lib/opendkim.ts:163-197](../../lib/opendkim.ts#L163-L197)): replace the SigningTable append block ([lines 180-185](../../lib/opendkim.ts#L180-L185)) with `parseSigningTable → addRule → serializeSigningTable → writeFile`. KeyTable block unchanged in Phase 1 (Phase 2 handles it).
   - `removeDomain` ([lib/opendkim.ts:199-219](../../lib/opendkim.ts#L199-L219)): replace SigningTable filter block ([lines 203-209](../../lib/opendkim.ts#L203-L209)) with `parseSigningTable → removeRule(by-selectorDomain-lookup) → serializeSigningTable → writeFile`. Note: `removeDomain` identifies by `selector._domainkey.domain` string; the new path finds the matching rule by `keyRef === selectorDomain` and removes it. If multiple rules reference the same `keyRef`, behaviour matches today (substring-match removes all — new code should find-all-matching to preserve that).
   - Old `parseSigningTable` function ([lines 37-46](../../lib/opendkim.ts#L37-L46)) retained as a thin wrapper delegating to `listRules(parseSigningTable_v2(...))` for backward compatibility. Remove when no callers remain (likely Phase 3 cleanup).

#### API

9. **`app/api/rules/signing/route.ts`** (new):
   - `GET` → 200 with `SigningRule[]` (list in file order).
   - `POST` body `{ pattern: string; keyRef: string; position?: number }` → 201 with `{ rule: SigningRule }`. 400 on missing fields. **409 with `{ error: 'DUPLICATE_ENTRY', message: string }` when `DuplicateEntryError` is thrown by `addRule`.**
   - `PATCH` body `{ order: string[] }` → 200 with `{ rules: SigningRule[] }`. Used for atomic reorder. 400 if `order` is not a string array; 409 if `order` doesn't contain every current rule id (or contains ids that don't exist).

10. **`app/api/rules/signing/[id]/route.ts`** (new):
    - `GET` → 200 with `{ rule: SigningRule }`. 404 if id absent.
    - `PUT` body `{ pattern: string; keyRef: string }` → 200 with `{ rule: SigningRule }` (new id derived from new content). 400 on missing fields; 404 if original id absent. **409 on `DuplicateEntryError` (proposed new content collides with a different existing rule).**
    - `DELETE` → 204. 404 if id absent.

All handlers centralise error-to-response mapping in a small helper: `DuplicateEntryError → 409`, `NotFoundError → 404`, validation errors → 400, anything else → 500 with the error message. The helper is introduced in Phase 1 at `lib/api-errors.ts` and reused by Phases 2 and 3.

11. **`app/api/rules/signing/route.test.ts`** (new) and **`app/api/rules/signing/[id]/route.test.ts`** (new): handler-level tests driving requests with an `OPENDKIM_CONFIG_DIR` pointing at a temp dir seeded from a fixture. Cover happy paths and the error codes listed above.

#### UI — routes

12. **`app/rules/signing/page.tsx`** (new, client component).
    - Fetches `GET /api/rules/signing`.
    - Renders a `Table` with columns: order badge, pattern, keyRef, actions (Edit → link to `/rules/signing/[id]`, Delete → confirm modal).
    - Up / down arrow buttons per row fire `PATCH /api/rules/signing` with reordered list.
    - "Add Rule" button → links to `/rules/signing/new`.
    - "About this page" button in header → `AboutThisPage` component with `components/help/SigningRulesPageHelp.tsx` content.
    - "View all signing rules" link is reached from this page's self-relationship to `/domains` (back-link).
    - Any API error (reorder conflict, delete of missing id, network failure) surfaced via a dismissible `Alert variant="danger"` at the top of the page, matching the existing pattern at [app/domains/page.tsx:141-147](../../app/domains/page.tsx).

13. **`app/rules/signing/new/page.tsx`** (new, client component).
    - Form with two inputs: pattern, keyRef.
    - Each input wrapped in `FieldTooltip` (short hover copy, ARIA).
    - `RowHelp` button next to each input opening `HelpModal` with level-2 content.
    - Submit → `POST /api/rules/signing` → on success, `router.push('/rules/signing')`. On 409, render dismissible `Alert variant="danger"` with the server's `message` (e.g. "A rule with this pattern and key reference already exists.") and leave the form populated so the user can correct.
    - "About this page" button → level-3 copy specific to "adding a signing rule".

14. **`app/rules/signing/[id]/page.tsx`** (new, client component).
    - `GET /api/rules/signing/[id]` on mount; 404 UI if absent.
    - Form prefilled.
    - Save → `PUT /api/rules/signing/[id]` → on success, `router.push('/rules/signing')`. On 409, dismissible `Alert` as above. On 404 (rule was deleted concurrently), show "This rule no longer exists" and a link back to the list.
    - Delete → confirm modal → `DELETE /api/rules/signing/[id]` → `router.push('/rules/signing')`. On 404, treat as success (already gone) but log once.
    - Deep-linkable: opening the URL in a fresh tab lands on this form in edit state directly.

15. **`app/domains/page.tsx`**: add a small "View all signing rules →" link in the page header. No other changes to this page. Existing Add Domain / View DNS / Verify / Delete flows untouched.

16. **`components/Navbar.tsx`** ([components/Navbar.tsx:7-40](../../components/Navbar.tsx#L7-L40)): add "Signing Rules" link between "Domains" and "Keys". Icon: `bi-list-ul` or similar.

#### UI — help surface

17. **`components/HelpModal.tsx`** (new). Props `{ show: boolean; onClose: () => void; title: string; children: React.ReactNode }`. Wraps react-bootstrap `Modal`.
18. **`components/AboutThisPage.tsx`** (new). Props `{ title: string; children: React.ReactNode }`. Renders an outline button with `bi-info-circle` icon; click opens a `HelpModal` whose body is `children`.
19. **`components/RowHelp.tsx`** (new). Props `{ title: string; children: React.ReactNode }`. Renders a small `[?]` icon button inline; click opens a `HelpModal`.
20. **`components/FieldTooltip.tsx`** (new). Props `{ content: string; placement?: Placement; children: ReactElement }`. Wraps child in `OverlayTrigger` + `Tooltip`; forwards refs; ensures `aria-describedby` is present on the trigger.
21. **`components/help/SigningRulesPageHelp.tsx`** (new). Static TSX. Level-3 copy explaining: what is a signing rule, how SigningTable maps mail to a key, why order matters, what cross-domain mappings / globs achieve, how to verify via DNS after editing.
22. **`components/help/SigningRulesAtoms.tsx`** (new). Exports named level-2 content snippets: `PatternHelp`, `KeyRefHelp`, `OrderHelp`, `CrossDomainMappingHelp`, `RefileDirectiveHelp`.

#### Behavioural expectations

23. Existing `/domains` Add Domain continues to generate its 1:1 signing rule via the new `addRule` path. Existing `/api/domains` POST/DELETE unchanged. User-visible effect: identical. Internal effect: round-trip-safe, won't clobber hand-edits.
24. `/config` page continues to render SigningTable as `<pre>`. Content reflects new rule writes.

### Success Criteria

#### Automated

- `make test` passes. Suite includes:
  - `lib/signing-table.test.ts` round-trip property for every fixture
  - Add / Update / Remove preserve all other lines byte-for-byte
  - Reorder carries leading blocks
  - Duplicate-content disambiguation produces unique ids for pre-existing legacy data
  - `addRule` / `updateRule` throw `DuplicateEntryError` when the resulting content would duplicate an existing rule
  - `removeRule` / `updateRule` throw `NotFoundError` on missing id
  - CRLF and no-trailing-newline fixtures round-trip intact
  - `lib/atomic-fs.test.ts` properties from section 4d (tmp-then-rename, failure cleanup)
  - `lib/write-lock.test.ts` properties from section 4e (serialisation, independent paths, rejection isolation)
  - API route handlers return 200 / 201 / 204 on happy path; 400 on malformed body; 404 on missing id; 409 on duplicate POST/PUT or on reorder id mismatch
- `make typecheck` passes (`tsc --noEmit` exits 0)
- `make lint` passes
- `make build` succeeds (`next build` produces .next/ with the new routes)

#### Manual

- Running `docker compose up --scale dkim-dashboard=2` in the deploy directory fails with a Compose error ("cannot scale service because it has a fixed container name") — confirms the single-instance invariant is codified
- Navigate to `/rules/signing` — existing `*@id.nextbestnetwork.com mail._domainkey.nextbestnetwork.com` rule appears
- Click "Add Rule" → enter `*@ursa.xalior.com` and `mail._domainkey.clientmail.xalior.com` (assumes `clientmail.xalior.com` has been added as a domain with key in a prior action) → submit → rule appears in the list and in `/etc/opendkim/SigningTable`
- Trigger opendkim reload via the `/config` reload button → `journalctl -u opendkim` shows reload; send test mail from ursa (`echo test | mail darran@xalior.com`); Gmail message headers show `dkim=pass d=clientmail.xalior.com`
- Reorder rules via up / down arrows — `/etc/opendkim/SigningTable` reflects the new order byte-for-byte
- Hand-add a line `# TODO: review next week` to `/etc/opendkim/SigningTable`, reload the dashboard, add a new rule via UI — comment is still present in the file after the write
- Existing Add Domain flow on `/domains` still works end-to-end
- Existing Delete Domain on `/domains` still works, and a hand-edited comment in SigningTable survives the delete
- `/rules/signing/[id]` is deep-linkable — copy the URL, open in a new private window, land directly on the edit form in edit state
- Click "About this page" → modal with level-3 help copy renders
- Click `[?]` next to the pattern field → modal with level-2 help copy renders
- Hover the pattern field → short tooltip appears
- Screen-reader check: tab to pattern field with VoiceOver / ChromeVox active; announcement includes the tooltip content (ARIA relationship is intact)
- Attempt to add a duplicate rule (same pattern + keyRef as existing) → form stays populated, red dismissible Alert appears with the duplicate error message; no change to `/etc/opendkim/SigningTable`
- Kill the dashboard container mid-write (best-effort — fire a POST and immediately `docker kill`) → `/etc/opendkim/SigningTable` is either fully pre-state or fully post-state, never half-written; any `.tmp.*` file in the config dir is either cleanly present pointing at intermediate content or absent

## Phase 2: KeyTable — thin (read-only UI, round-trip writer)

**Provisional shape — re-review at end of Phase 1.** The detail below is the best design available today, but the Phase-1 build may surface reasons to restructure (e.g. the `leading`-block model turns out awkward, malformed-entry UX needs rethinking, or the test fixtures should be richer). Treat this section as a strong starting point for that re-review, not a contract.

### Overview

Give KeyTable the same round-trip-safety treatment as Phase 1 without exposing edit controls. Parser captures every line (entries, comments, blanks, malformed); writer preserves original bytes for untouched lines. `addDomain` and `removeDomain` are rewired to the new writer so their side-effect on KeyTable no longer risks clobbering hand-edited content. UI surfaces every KeyTable entry read-only — including non-canonical rows the current `/keys` page can't see today — with deep-link view routes. After this phase ships, a separate design conversation decides the shape of the R/W editor (not part of this plan).

### Changes Required

#### Data model & parser/writer

1. **`lib/key-table.ts`** (new). Types and functions analogous to `lib/signing-table.ts`:
   - `type KeyTableLine`: `{ kind: 'entry'; id: string; selectorDomain: string; domain: string; selector: string; keyPath: string; rawLine?: string; leading: PreambleLine[] }` | `{ kind: 'entry-malformed'; id: string; rawLine: string; leading: PreambleLine[] }` | `{ kind: 'trailing'; lines: PreambleLine[] }`.
   - `type KeyEntry = { id: string; selectorDomain: string; domain: string; selector: string; keyPath: string; malformed: boolean; rawLine: string }` — consumer-facing. Malformed entries still appear in `listEntries` with `malformed: true`; UI decides display.
   - `parseKeyTable(content)`, `serializeKeyTable(lines)`, `listEntries`, `addEntry`, `updateEntry`, `removeEntry`, `saveKeyTable(lines)`. No `reorder` — KeyTable is not order-sensitive.
   - `addEntry` throws `DuplicateEntryError` if an entry with the same `selectorDomain` already exists (KeyTable is a lookup map keyed by selectorDomain — multiple entries with the same key would be ambiguous).
   - `addDomain` / `removeDomain` in `lib/opendkim.ts` are refactored to check-before-add idempotently: if the exact entry already exists, skip silently (matches current behaviour at [lib/opendkim.ts:192](../../lib/opendkim.ts#L192)); if `selectorDomain` exists with a *different* value, surface the `DuplicateEntryError` to the caller. This covers the edge case of a hand-edited KeyTable conflict.
   - `saveKeyTable` wraps serialize + `withLock(keyTablePath) + writeFileAtomic` — same concurrency/atomicity guarantees as Phase 1.
   - ID = `base64url(sha256(selectorDomain + '\0' + domain + '\0' + selector + '\0' + keyPath)).slice(0,12)` for well-formed entries; for malformed, `sha256(rawLine).slice(0,12)`. Disambiguator suffix applies only to pre-existing legacy data; new writes can't introduce duplicates.
   - Malformed: line where splitting by whitespace gives fewer than 2 parts OR where the colon-split of parts[1] yields fewer than 3 segments. Captured faithfully in `rawLine`.

2. **`lib/key-table.test.ts`** (new). Properties:
   - Round-trip identity across all fixtures
   - `addEntry` / `removeEntry` don't touch other lines
   - Malformed entries preserved byte-for-byte through round-trip
   - `updateEntry` (internal use via refactored `addDomain`) clears `rawLine`, emits canonical

3. **`lib/__fixtures__/key-table/`** (new dir):
   - `canonical.txt`, `with-comments.txt`, `malformed.txt` (a line with only 2 colon-separated parts; a line with extra whitespace and trailing comment), `crlf.txt`, `empty.txt`, `no-trailing-newline.txt`.

4. **`lib/opendkim.ts`** refactor:
   - `addDomain` ([lib/opendkim.ts:187-194](../../lib/opendkim.ts#L187-L194)): replace KeyTable append block with `parseKeyTable → addEntry → serializeKeyTable → writeFile`.
   - `removeDomain` ([lib/opendkim.ts:211-218](../../lib/opendkim.ts#L211-L218)): replace KeyTable filter block with `parseKeyTable → removeEntry → serializeKeyTable → writeFile`.
   - Old `parseKeyTable` function ([lines 48-64](../../lib/opendkim.ts#L48-L64)) retained as a thin wrapper delegating to `listEntries(parseKeyTable_v2(...))` for backward compatibility with `getDomains`.

#### API

5. **`app/api/rules/keys/route.ts`** (new):
   - `GET` → 200 with `KeyEntry[]` including malformed (flagged). Other methods intentionally absent this phase (future R/W PR).

6. **`app/api/rules/keys/[id]/route.ts`** (new):
   - `GET` → 200 with `{ entry: KeyEntry; diskFiles: string[]; dnsExpected: DnsExpected | null; dnsVerification: DnsVerification | null }`. For malformed entries, `diskFiles` / `dnsExpected` / `dnsVerification` are `null`. 404 if id absent.

7. **`app/api/rules/keys/route.test.ts`** + **`app/api/rules/keys/[id]/route.test.ts`** (new): handler-level tests with fixture-seeded temp dir.

#### UI — routes

8. **`app/keys/page.tsx`** rewrite ([app/keys/page.tsx:15-174](../../app/keys/page.tsx#L15-L174)):
   - Fetch `GET /api/rules/keys` (replaces `/api/keys`).
   - Render every entry in a table. Canonical entries retain the Regenerate button (existing behaviour, unchanged). Malformed entries show a "non-standard entry" badge and a "View" link to `/rules/keys/[id]`; no Regenerate button.
   - "About this page" button in header.
   - Existing Regenerate confirmation modal unchanged.

9. **`app/rules/keys/[id]/page.tsx`** (new, client component):
   - `GET /api/rules/keys/[id]` on mount; 404 UI if absent.
   - Read-only detail view: selectorDomain, domain, selector, keyPath, file listing, expected DNS record, live DNS verification status.
   - Malformed entries: show the raw line, explain why it doesn't parse, link to `/keys` with note about reloading the reference file.
   - "About this page" + row `[?]` + field tooltips on value displays (tooltips on read-only values explain the concept, not an interaction).

10. **`app/api/keys/route.ts`** ([app/api/keys/route.ts:4-22](../../app/api/keys/route.ts#L4-L22)): remove — no callers after step 8.
11. **`components/Navbar.tsx`**: no change ("Keys" already in navbar).

#### UI — help surface

12. **`components/help/KeyEntriesPageHelp.tsx`** (new). Level-3 copy: what is a key entry, selectorDomain vs. the domain:selector:keyPath value, why malformed lines exist, relationship to SigningTable keyRef.
13. **`components/help/KeyEntriesAtoms.tsx`** (new). Level-2 snippets: `SelectorDomainHelp`, `DomainHelp`, `SelectorHelp`, `KeyPathHelp`, `MalformedEntryHelp`.
14. Reuses `HelpModal`, `AboutThisPage`, `RowHelp`, `FieldTooltip` from Phase 1.

#### Behavioural expectations

15. Existing Add Domain ([app/domains/page.tsx:100](../../app/domains/page.tsx)) still works; KeyTable write now goes through the round-trip-safe path.
16. Existing Delete Domain still works; KeyTable delete no longer clobbers non-canonical content.
17. Existing `/api/keys` endpoint removed; `/keys` page fully migrated.

### Success Criteria

#### Automated

- `make test` passes, with new `lib/key-table.test.ts`. Specific properties:
  - Round-trip identity for every fixture
  - `addDomain` appends a canonical KeyTable entry without touching other lines
  - `removeDomain` removes matching entry without touching other lines
  - Malformed entries survive round-trip byte-for-byte
  - API GET returns malformed entries with the `malformed: true` flag
- `make typecheck`, `make lint`, `make build` all pass

#### Manual

- Hand-add a non-canonical line to `/etc/opendkim/KeyTable` (e.g. `weirdSelector arbitrary:content:here  # placeholder for future`). Reload the dashboard, visit `/keys` — line appears with the "non-standard entry" badge
- Existing Regenerate Key button still works for canonical entries; the file on disk retains the hand-added malformed line afterward
- Click a key row → deep-links to `/rules/keys/[id]` → detail view renders (for canonical: domain/selector/keyPath/DNS status; for malformed: raw line + explanation)
- Perform Add Domain flow on `/domains` — the malformed line still exists in `/etc/opendkim/KeyTable` after completion
- Perform Delete Domain on `/domains` — the malformed line still exists after completion
- `/rules/keys/[id]` deep-link works from a fresh tab
- "About this page" / `[?]` / tooltip surfaces render expected content

## Phase 3: TrustedHosts first-class

**Provisional shape — re-review at end of Phase 2.** This phase inherits provisional status from Phase 2 (whose own shape is provisional pending Phase 1), so the detail below has been through two review gates' worth of uncertainty by the time work starts. In particular: the decision on KeyTable R/W made after Phase 2 is likely to shape what "full CRUD modelled on Phase 1" means here.

### Overview

Give TrustedHosts the same first-class, round-trip-safe treatment as Phase 1 with full CRUD UI. Each entry (IP, CIDR, hostname, `refile:` directive) becomes addressable on its own route (`/trusted-hosts/[id]`). Comments, blank lines, `refile:` directives, inline comments survive round-trip. The existing `/trusted-hosts` page is rewritten from "edit list + dirty flag + save" to per-entry edit flow. TrustedHosts isn't order-sensitive in opendkim semantics, so no reorder UI. Help ships in three tiers.

### Changes Required

#### Data model & parser/writer

1. **`lib/trusted-hosts.ts`** (new). Analogous to `lib/signing-table.ts` minus reorder:
   - `type TrustedHostsLine`: `{ kind: 'entry'; id: string; value: string; inlineComment?: string; rawLine?: string; leading: PreambleLine[] }` | `{ kind: 'trailing'; lines: PreambleLine[] }`.
   - `type TrustedHostEntry = { id: string; value: string; isRefile: boolean; inlineComment?: string }`.
   - `parseTrustedHosts`, `serializeTrustedHosts`, `listEntries`, `addEntry`, `updateEntry`, `removeEntry`, `saveTrustedHosts(lines)`. No `reorder`.
   - `addEntry` / `updateEntry` throw `DuplicateEntryError` when the resulting `value` would collide with an existing entry; `removeEntry` / `updateEntry` throw `NotFoundError` on missing id. API handlers map to 409 / 404 consistent with Phase 1.
   - `saveTrustedHosts` wraps serialize + `withLock(trustedHostsPath) + writeFileAtomic` — same guarantees as Phase 1.
   - ID = `base64url(sha256(value)).slice(0,12)` with disambiguator suffix (legacy data only; new writes can't introduce duplicates).
   - `isRefile` = `value.startsWith('refile:')`.
   - Inline-comment handling: if a line contains `#` preceded by whitespace, the trailing portion is captured as `inlineComment` (preserved on round-trip); serialization for edited entries drops the inline comment (simpler canonical form) — flagged as a behavioural note in manual criteria.

2. **`lib/trusted-hosts.test.ts`** (new). Properties:
   - Round-trip identity for all fixtures
   - CRUD preserves untouched lines
   - `refile:` directives round-trip with `isRefile: true`
   - Inline comments preserved byte-for-byte on untouched lines; dropped canonically on `updateEntry`

3. **`lib/__fixtures__/trusted-hosts/`** (new dir):
   - `canonical.txt` (IPs + CIDRs + hostnames), `with-comments.txt`, `with-refile.txt`, `inline-comments.txt`, `crlf.txt`, `empty.txt`, `single-entry.txt`.

4. **`lib/opendkim.ts`**: replace `saveTrustedHosts` ([lib/opendkim.ts:221-224](../../lib/opendkim.ts#L221-L224)). Signature no longer used externally after API rewrite (step 5); remove export, keep `readTrustedHosts` + `parseTrustedHosts` as thin wrappers over `listEntries(parseTrustedHosts_v2(...))` for backward compat with `app/api/trusted-hosts/route.ts` GET.

#### API

5. **`app/api/trusted-hosts/route.ts`** rewrite ([app/api/trusted-hosts/route.ts:4-25](../../app/api/trusted-hosts/route.ts#L4-L25)):
   - `GET` → 200 with `TrustedHostEntry[]` including `refile:` entries (flagged).
   - `POST` body `{ value: string; position?: number }` → 201 with `{ entry: TrustedHostEntry }`. 400 if `value` missing / empty.
   - `PUT` bulk-save (existing) → removed. Only caller is the current `/trusted-hosts` page, rewritten in step 7.

6. **`app/api/trusted-hosts/[id]/route.ts`** (new):
   - `GET` → 200 `{ entry }`. 404 if absent.
   - `PUT` body `{ value: string }` → 200 `{ entry }` (new id). 400 on missing `value`; 404 on missing original id.
   - `DELETE` → 204. 404 if absent.

7. **`app/api/trusted-hosts/route.test.ts`** + **`app/api/trusted-hosts/[id]/route.test.ts`** (new): handler-level tests with fixture-seeded temp dir.

#### UI — routes

8. **`app/trusted-hosts/page.tsx`** rewrite ([app/trusted-hosts/page.tsx:12-138](../../app/trusted-hosts/page.tsx#L12-L138)):
   - Fetch `GET /api/trusted-hosts`.
   - Render `ListGroup` of entries; each row shows `value` (with `refile:` badge if `isRefile`), Edit link to `/trusted-hosts/[id]`, Delete button (confirm modal → `DELETE`).
   - "Add Trusted Host" button → links to `/trusted-hosts/new`.
   - Dirty-flag bulk-save model removed entirely.
   - "About this page" button in header.

9. **`app/trusted-hosts/new/page.tsx`** (new, client):
   - Form with `value` field + `FieldTooltip` + `RowHelp`.
   - Submit → `POST /api/trusted-hosts` → `router.push('/trusted-hosts')`.
   - Help surfaces explain `refile:` directive format.

10. **`app/trusted-hosts/[id]/page.tsx`** (new, client):
    - `GET /api/trusted-hosts/[id]`; 404 UI if absent.
    - Form prefilled.
    - Save → `PUT` → navigate back to list.
    - Delete → confirm modal → `DELETE` → navigate back to list.

#### UI — help surface

11. **`components/help/TrustedHostsPageHelp.tsx`** (new). Level-3 copy: what is a trusted host, how TrustedHosts is referenced by both `ExternalIgnoreList` and `InternalHosts` in opendkim.conf, the `refile:` directive, semantic difference between the two roles.
12. **`components/help/TrustedHostsAtoms.tsx`** (new). Level-2 snippets: `IpHelp`, `CidrHelp`, `HostnameHelp`, `RefileDirectiveHelp` (shared with Phase 1's same-named atom — DRY via re-export), `InlineCommentHelp`.
13. Reuses `HelpModal`, `AboutThisPage`, `RowHelp`, `FieldTooltip` from Phase 1.

#### Behavioural expectations

14. Hand-edited comments in `/etc/opendkim/TrustedHosts` survive any UI add / edit / delete.
15. `refile:` directives are displayed with a "refile" badge and are editable as a raw value (no special parsing of the referenced file — that's out of scope).
16. Editing an existing entry via UI drops its inline comment (canonical form). Untouched entries retain inline comments. Documented in the help modal.

### Success Criteria

#### Automated

- `make test` passes with `lib/trusted-hosts.test.ts`. Specific properties:
  - Round-trip identity for every fixture
  - Add / Update / Remove isolates the target; all other lines unchanged
  - `refile:` entries round-trip with `isRefile: true`
  - Inline comments preserved on untouched lines; dropped on `updateEntry` (asserted explicitly)
- API route handler tests: POST / PUT / DELETE / GET success paths; 400 / 404 paths
- `make typecheck`, `make lint`, `make build` all pass

#### Manual

- On ursa, hand-add a line `# allow office network` above an existing entry in `/etc/opendkim/TrustedHosts`
- Reload the dashboard, visit `/trusted-hosts` — the comment is not visible as a row (attached as leading metadata), but subsequent rows render correctly
- Add a new entry through the UI; check `/etc/opendkim/TrustedHosts` — the original `# allow office network` is still present
- Edit an existing entry via `/trusted-hosts/[id]` — other lines byte-for-byte unchanged
- Add a `refile:/etc/opendkim/IgnoreHosts` entry; the refile badge appears; the file contains the directive exactly
- Delete an entry → the entry and its leading block are removed; surrounding lines untouched
- Add an entry with an inline comment via UI (e.g. `192.168.1.0/24 # office`), then edit that entry — confirm the inline comment is dropped (per behavioural note 16) and the help modal explains this
- `/trusted-hosts/[id]` deep-link works from a fresh tab
- "About this page" / `[?]` / tooltip surfaces render expected content
- Reload opendkim via `/config` → `journalctl -u opendkim` shows the reload; mail signing from a trusted host continues to work

## Testing Strategy

**Framework.** Vitest introduced in Phase 1 (`make test`), reused in Phases 2 and 3.

**Layering.**

- **Unit tests** cover each new `lib/<table>.ts` module: parser/writer round-trip, CRUD helpers, ordering (Phase 1 only), disambiguation. Pure-function tests against fixture strings — no filesystem, no DNS, no network.
- **Handler-level integration tests** cover each new API route file by importing the route handler and calling it with a constructed `Request`. Filesystem access is redirected via `OPENDKIM_CONFIG_DIR` pointing at a per-test temp dir seeded from fixtures; cleanup via `afterEach`.
- **No e2e / browser tests** in this plan. Manual acceptance criteria cover UI behaviour and deep-link routing per phase.

**Fixtures.** One directory per table under `lib/__fixtures__/`. Each directory carries canonical, comment-bearing, CRLF, empty, and no-trailing-newline variants at minimum, plus table-specific non-canonical shapes (glob / cross-domain / `refile:` / malformed).

**Core invariant.** For every table parser/writer, `serialize(parse(f)) === f` must hold byte-for-byte for every fixture. This is the first test written for each new module. Any future writer change that breaks this property fails CI locally (`make test`).

**Manual verification.** Each phase's Manual success criteria are executed against ursa (or a staging equivalent with mounted `/etc/opendkim/*`) *after* the automated suite passes, not before.

**CI hookup.** `make ci` is defined locally to chain `lint → typecheck → test → build`. Hooking this into a GitHub Actions workflow is explicitly out of scope for this plan — it's a repo concern, not a dashboard concern.

## References

- Pre-plan: [docs/plans/preplan_signingtable-cross-domain.md](preplan_signingtable-cross-domain.md)
- Core lib: [lib/opendkim.ts](../../lib/opendkim.ts)
- Pages: [app/domains/page.tsx](../../app/domains/page.tsx), [app/keys/page.tsx](../../app/keys/page.tsx), [app/trusted-hosts/page.tsx](../../app/trusted-hosts/page.tsx), [app/config/page.tsx](../../app/config/page.tsx), [app/page.tsx](../../app/page.tsx)
- API routes: `app/api/domains/route.ts`, `app/api/keys/route.ts`, `app/api/keys/generate/route.ts`, `app/api/trusted-hosts/route.ts`, `app/api/dns/route.ts`, `app/api/config/route.ts`, `app/api/service/route.ts`
- Navbar: [components/Navbar.tsx](../../components/Navbar.tsx)
- OpenDKIM semantics: `man opendkim.conf`; SigningTable first-match-wins; KeyTable is a lookup map; TrustedHosts referenced by `ExternalIgnoreList` and `InternalHosts`
