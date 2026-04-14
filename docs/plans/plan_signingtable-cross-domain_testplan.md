# Local test plan — Phase 1 Signing Rules

**Target:** `feature/signingtable-cross-domain` on a local dev box (nancy) **without** a running `opendkim` service. Real-mail / DNS / `reload` checks from the plan's Manual criteria are deliberately out of scope here; everything below is verifiable against the on-disk `./data/opendkim/SigningTable` and the browser UI.

## 0. Prerequisites

- Node 20+ and `pnpm`.
- Repo checked out at `feature/signingtable-cross-domain` (or a worktree at it).
- `.env.local` exists and points at `./data/opendkim/`. The repo ships one — verify with:
  ```bash
  cat .env.local
  # OPENDKIM_CONFIG_DIR=./data/opendkim
  ```
- Seed data already present at `data/opendkim/SigningTable`:
  ```
  *@id.nextbestnetwork.com mail._domainkey.nextbestnetwork.com
  *@example.com mail._domainkey.example.com
  ```
  If missing, restore from `data/opendkim_conf.tar.gz` before starting.

## 1. Static checks (re-run locally)

```bash
make ci     # lint → typecheck → test → build
```

Expected:
- [ ] `make lint` — no output
- [ ] `make typecheck` — no output
- [ ] `make test` — **52 passed** across 5 files
- [ ] `make build` — succeeds; route list includes `/rules/signing`, `/rules/signing/new`, `/rules/signing/[id]`, `/api/rules/signing`, `/api/rules/signing/[id]`

## 2. Start the dev server

```bash
pnpm dev
```

Open <http://localhost:3000>. Keep a second terminal tailing the file under test:

```bash
watch -n 0.5 'cat data/opendkim/SigningTable'
```

## 3. Baseline — list page renders

1. Click **Signing Rules** in the navbar.
2. The URL is `/rules/signing` and the page renders a table with **two rows**, in file order:
   - `*@id.nextbestnetwork.com` → `mail._domainkey.nextbestnetwork.com`
   - `*@example.com` → `mail._domainkey.example.com`

Checks:
- [ ] Navbar highlights **Signing Rules**.
- [ ] "Order" column shows `1` and `2`.
- [ ] "About this page" button is visible in the header.
- [ ] Back-link **← Back to Domains** is visible under the page title.

## 4. Add a canonical rule

1. Click **Add Rule** → land on `/rules/signing/new`.
2. Fill `Pattern = *@test-local.example` and `Key reference = mail._domainkey.test-local.example`.
3. Hover the pattern field → tooltip shows (≈ "Sender-address pattern. Supports * as wildcard…").
4. Click **Add rule**.

Checks:
- [ ] Redirected back to `/rules/signing`.
- [ ] New row appears at the **bottom** of the list (Order 3).
- [ ] `data/opendkim/SigningTable` now contains the new line as its 3rd entry.
- [ ] Original two lines are unchanged byte-for-byte.

## 5. Add a cross-domain rule (the originating driver)

1. Click **Add Rule**.
2. Fill `Pattern = *@ursa.xalior.com` and `Key reference = mail._domainkey.clientmail.xalior.com`.
3. Click the `[?]` next to the pattern label — the modal shows level-2 copy including the **Cross-domain mapping** section.
4. Close the modal; submit the form.

Checks:
- [ ] Redirected to `/rules/signing`; new row at the bottom.
- [ ] On-disk file has 4 lines, with the cross-domain rule last.
- [ ] Row does **not** show the "non-standard" badge (it's a canonical two-token line).

## 6. Edit a rule (new id on save, deep-linkable)

1. From the list, click the pencil on row 3 (`*@test-local.example`).
2. Current URL shape: `/rules/signing/<id>` — **copy this URL** to the clipboard.
3. Change `Pattern` to `*@test-local-renamed.example` and save.

Checks:
- [ ] Redirected to `/rules/signing`; the row now shows the renamed pattern.
- [ ] On-disk file reflects the rename; the OTHER three rules are byte-for-byte unchanged.
- [ ] Paste the previously-copied URL into a **new private window** → you land on a **"Rule not found"** page (id changed on save — this is the plan's honest-URL behaviour).
- [ ] From the "not found" page, click **Back to signing rules** — list renders.

Then test a deep-link that **does** still resolve:
1. Copy the URL of the cross-domain rule's edit page.
2. Open it in a new private window → edit form is prefilled with the cross-domain rule. No round-trip through the list page first.

Checks:
- [ ] Deep-link lands directly in edit state.

## 7. Reorder (first-match-wins is semantic)

1. Click ▲ on the last row repeatedly until the cross-domain rule is at position 1.
2. Watch the `SigningTable` file in the other terminal between clicks.

Checks:
- [ ] Each click updates the file immediately and atomically (you never see a half-written file).
- [ ] Final row order in the UI matches the file order byte-for-byte.
- [ ] The comment-free seed lines that weren't touched are still byte-identical to their originals.

## 8. Duplicate-rule guard (409)

1. Add Rule → enter exactly the same pattern + key reference as the cross-domain rule (`*@ursa.xalior.com` / `mail._domainkey.clientmail.xalior.com`).
2. Submit.

Checks:
- [ ] Page does **not** redirect.
- [ ] Form stays populated.
- [ ] A red dismissible Alert appears at the top with a "Duplicate signing-rule…" message.
- [ ] On-disk file is unchanged (no new line added).
- [ ] Dismissing the Alert works; the X button closes it.

## 9. Validation guard (400)

1. Add Rule → leave Pattern blank and try to submit.

Checks:
- [ ] HTML5 validation blocks submission (the `Add rule` button is disabled if either field is empty — or the browser prompts).
- [ ] Confirm the server-side 400 path by opening DevTools → Network, then manually `fetch('/api/rules/signing', { method: 'POST', body: JSON.stringify({}) })` from the console. Response should be **400** with body `{ "error": "VALIDATION_ERROR", "message": "..." }`.

## 10. Delete (and comment preservation)

Set up: hand-add a comment block to the file so we can watch it survive.

```bash
# In a shell, with the dashboard still running:
printf '\n# TODO: review these smarthost rules before next release\n' >> data/opendkim/SigningTable
cat data/opendkim/SigningTable
```

1. In the UI, click **Refresh** on the list page.
2. Click the trash icon on row 2 (originally `*@example.com`) → confirm in the modal.

Checks:
- [ ] That rule (and its adjacent leading block, if any) is removed.
- [ ] The `# TODO: review…` comment you hand-added is **still present** in the file.
- [ ] All other rules unchanged byte-for-byte.
- [ ] Trailing newline state of the file is preserved (no accidental drop-the-terminal-newline bug).

Bonus — test the edit-then-delete path:
1. Go to an edit page, click **Delete** there, confirm.
2. You're redirected to the list; the rule is gone.

## 11. 3-tier help surface

From the list page:
- [ ] **About this page** → modal shows the level-3 copy with sections "How it maps to the file", "Why the order matters", "Cross-domain and glob patterns", "Hand-edits survive".
- [ ] `[?]` next to **Pattern** column → modal shows `PatternHelp` + divider + `CrossDomainMappingHelp`.
- [ ] `[?]` next to **Key reference** column → modal shows `RefileDirectiveHelp`.
- [ ] `[?]` next to the **Actions** header → modal shows `OrderHelp`.

From `/rules/signing/new` (and the edit page):
- [ ] `[?]` next to **Pattern** field label → level-2 `PatternHelp`.
- [ ] `[?]` next to **Key reference** field label → level-2 `KeyRefHelp`.
- [ ] Hover over Pattern input → tooltip appears.
- [ ] Hover over Key reference input → tooltip appears.
- [ ] **About this page** on the new-rule page → modal explains when to use this vs Add Domain, plus `CrossDomainMappingHelp`.

## 12. Keyboard + a11y spot check

On `/rules/signing/new`:
- [ ] Tab into the Pattern input. Focus ring visible.
- [ ] Safari's VoiceOver (Cmd-F5) or macOS ChromeVox announces something like "Pattern, edit text, Sender-address pattern. Supports * as wildcard…". The tooltip content appears in the announcement because it's wired via `aria-describedby`.
- [ ] Tab → Key reference behaves the same.
- [ ] Esc on any open modal closes it without submitting anything.

## 13. Back-compat with existing Domains flow

1. Go to `/domains`.
2. Click **Add Domain**, add a new domain (e.g. `localtest.example` with selector `mail`, from-pattern `*@localtest.example`).
3. Watch the Signing Rules list and the on-disk file.

Checks:
- [ ] New domain appears on `/domains`.
- [ ] `/rules/signing` shows the new auto-generated signing rule at the bottom.
- [ ] `data/opendkim/SigningTable` gains the expected line.
- [ ] `data/opendkim/KeyTable` gains the matching entry (Phase 2 covers KeyTable safety, not this test).
- [ ] The hand-added `# TODO: review…` comment from step 10 is still present.

Then delete that domain from `/domains`:
- [ ] Its signing rule disappears from `/rules/signing`.
- [ ] The `# TODO: review…` comment still survives.

## 14. Single-instance invariant (Docker required — optional locally)

Only if Docker is installed locally:

```bash
docker compose up --scale dkim-dashboard=2
```

- [ ] Compose refuses with an error naming `container_name`.

If Docker isn't set up on nancy, skip this. The CI-equivalent check is the `docker-compose.yml` diff — `container_name: dkim-dashboard` is present on the service.

## 15. Atomicity under crash (optional, filesystem-level)

Since nancy isn't running opendkim, the "kill the container mid-write" check becomes: after any failed-mid-write scenario, the `SigningTable` file is either fully pre-state or fully post-state. For a local variant:

1. Make `data/opendkim/` read-only: `chmod 0500 data/opendkim`.
2. In the UI, try to add or edit a rule → expect a 500 with a "permission denied" message in the Alert.
3. `ls -la data/opendkim/.SigningTable.tmp.*` — there should be **no** leftover tmp files; the `writeFile(tmp)` failed before rename and cleanup ran.
4. Restore: `chmod 0755 data/opendkim`. Confirm the file is unchanged byte-for-byte from step-10's baseline.

Checks:
- [ ] Failed writes leave the file untouched.
- [ ] No `.tmp.*` files linger.

## 16. Teardown

```bash
git checkout -- data/opendkim/
rm -rf .next
```

Optional: stop the dev server.

---

## Reporting results

When you're done, either tick the boxes in this doc and push, or paste a summary (which sections passed vs. failed). If anything fails, the most useful info is:
- the section number
- what you expected vs what you saw
- the on-disk `data/opendkim/SigningTable` content at the moment of failure

Once everything green-lights, Phase 1 is signed off and we can re-review Phase 2 (KeyTable thin) per the plan's review gate.
