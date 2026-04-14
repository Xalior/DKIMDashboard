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
- [x] `make lint` — no output
- [x] `make typecheck` — no output
- [x] `make test` — **52 passed** across 5 files
- [x] `make build` — succeeds; route list includes `/rules/signing`, `/rules/signing/new`, `/rules/signing/[id]`, `/api/rules/signing`, `/api/rules/signing/[id]`

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
- [x] Navbar highlights **Signing Rules**.
- [x] "Order" column shows `1` and `2`.
- [x] "About this page" button is visible in the header.
- [x] Back-link **← Back to Domains** is visible under the page title.

## 4. Add a canonical rule

1. Click **Add Rule** → land on `/rules/signing/new`.
2. Fill `Pattern = *@test-local.example` and `Key reference = mail._domainkey.test-local.example`.
3. Hover the pattern field → tooltip shows (≈ "Sender-address pattern. Supports * as wildcard…").
4. Click **Add rule**.

Checks:
- [x] Redirected back to `/rules/signing`.
- [x] New row appears at the **bottom** of the list (Order 3).
- [x] `data/opendkim/SigningTable` now contains the new line as its 3rd entry.
- [x] Original two lines are unchanged byte-for-byte.

## 5. Add a cross-domain rule (the originating driver)

1. Click **Add Rule**.
2. Fill `Pattern = *@ursa.xalior.com` and `Key reference = mail._domainkey.clientmail.xalior.com`.
3. Click the `[?]` next to the pattern label — the modal shows level-2 copy including the **Cross-domain mapping** section.
4. Close the modal; submit the form.

Checks:
- [x] Redirected to `/rules/signing`; new row at the bottom.
- [x] On-disk file has 4 lines, with the cross-domain rule last.
- [x] Row does **not** show the "non-standard" badge (it's a canonical two-token line).

## 6. Edit a rule (new id on save, deep-linkable)

1. From the list, click the pencil on row 3 (`*@test-local.example`).
2. Current URL shape: `/rules/signing/<id>` — **copy this URL** to the clipboard.
3. Change `Pattern` to `*@test-local-renamed.example` and save.

Checks:
- [x] Redirected to `/rules/signing`; the row now shows the renamed pattern.
- [x] On-disk file reflects the rename; the OTHER three rules are byte-for-byte unchanged.
- [x] Paste the previously-copied URL into a **new private window** → you land on a **"Rule not found"** page (id changed on save — this is the plan's honest-URL behaviour).
- [x] From the "not found" page, click **Back to signing rules** — list renders.

Then test a deep-link that **does** still resolve:
1. Copy the URL of the cross-domain rule's edit page.
2. Open it in a new private window → edit form is prefilled with the cross-domain rule. No round-trip through the list page first.

Checks:
- [x] Deep-link lands directly in edit state.

## 7. Reorder (first-match-wins is semantic)

1. Click ▲ on the last row repeatedly until the cross-domain rule is at position 1.
2. Watch the `SigningTable` file in the other terminal between clicks.

Checks:
- [x] Each click updates the file immediately and atomically (you never see a half-written file).
- [x] Final row order in the UI matches the file order byte-for-byte.
- [x] The comment-free seed lines that weren't touched are still byte-identical to their originals.

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
- [x] **About this page** → modal shows the level-3 copy with sections "How it maps to the file", "Why the order matters", "Cross-domain and glob patterns", "Hand-edits survive".
- [x] `[?]` next to **Pattern** column → modal shows `PatternHelp` + divider + `CrossDomainMappingHelp`.
- [x] `[?]` next to **Key reference** column → modal shows `RefileDirectiveHelp`.
- [X] `[?]` next to the **Actions** header → modal shows `OrderHelp`.

From `/rules/signing/new` (and the edit page):
- [x] `[?]` next to **Pattern** field label → level-2 `PatternHelp`.
- [x] `[?]` next to **Key reference** field label → level-2 `KeyRefHelp`.
- [x] Hover over Pattern input → tooltip appears.
- [x] Hover over Key reference input → tooltip appears.
- [x] **About this page** on the new-rule page → modal explains when to use this vs Add Domain, plus `CrossDomainMappingHelp`.

## 12. Keyboard + a11y spot check

On `/rules/signing/new`:
- [x] Tab into the Pattern input. Focus ring visible.
- [x] Safari's VoiceOver (Cmd-F5) or macOS ChromeVox announces something like "Pattern, edit text, Sender-address pattern. Supports * as wildcard…". The tooltip content appears in the announcement because it's wired via `aria-describedby`.
- [x] Tab → Key reference behaves the same.
- [x] Esc on any open modal closes it without submitting anything.

## 13. Back-compat with existing Domains flow

1. Go to `/domains`.
2. Click **Add Domain**, add a new domain (e.g. `localtest.example` with selector `mail`, from-pattern `*@localtest.example`).
3. Watch the Signing Rules list and the on-disk file.

Checks:
- [x] New domain appears on `/domains`.
- [x] `/rules/signing` shows the new auto-generated signing rule at the bottom.
- [x] `data/opendkim/SigningTable` gains the expected line.
- [x] `data/opendkim/KeyTable` gains the matching entry (Phase 2 covers KeyTable safety, not this test).
- [x] The hand-added `# TODO: review…` comment from step 10 is still present.

Then delete that domain from `/domains`:
- [x] Its signing rule disappears from `/rules/signing`.
- [x] The `# TODO: review…` comment still survives.

## 14. Single-instance invariant (Docker required — optional locally)

The invariant the plan wants proven is: the compose file has a fixed `container_name`, so Docker refuses to run a second instance. The `docker compose up --scale` flag varies across compose versions, so the test plan gives three equivalent checks — any one passing is sufficient.

**Option A — inspect the resolved config (no daemon needed):**

```bash
docker compose config | grep container_name
```

- [ ] Output contains `container_name: dkim-dashboard`.

**Option B — trigger the conflict directly:**

```bash
docker compose up -d
docker run --name dkim-dashboard --rm alpine true
# → Error: Conflict. The container name "/dkim-dashboard" is already in use...
docker compose down
```

- [ ] The second `docker run` fails with a name-conflict error.

**Option C — compose scale subcommand:**

```bash
docker compose up -d
docker compose scale dkim-dashboard=2
# → Same conflict error
docker compose down
```

- [ ] `docker compose scale` refuses with an error naming `container_name`.

If Docker isn't set up on nancy, skip this section entirely. The CI-equivalent check is the `docker-compose.yml` diff — `container_name: dkim-dashboard` is present on the service.

## 15. Atomicity under crash (optional, filesystem-level)

Since nancy isn't running opendkim, the "kill the container mid-write" check becomes: after any failed-mid-write scenario, the `SigningTable` file is either fully pre-state or fully post-state. For a local variant:

1. Make `data/opendkim/` read-only: `chmod 0500 data/opendkim`.
2. In the UI, try to add or edit a rule → expect a 500 with a "permission denied" message in the Alert.
3. `ls -la data/opendkim/.SigningTable.tmp.*` — there should be **no** leftover tmp files; the `writeFile(tmp)` failed before rename and cleanup ran.
4. Restore: `chmod 0755 data/opendkim`. Confirm the file is unchanged byte-for-byte from step-10's baseline.

Checks:
- [x] Failed writes leave the file untouched.
- [x] No `.tmp.*` files linger.

## 16. Teardown

`data/` is gitignored — `git checkout` won't restore it. Reset the seed from the bundled tarball:

```bash
rm -rf data/opendkim
tar -xzf data/opendkim_conf.tar.gz -C /tmp
mv /tmp/etc/opendkim data/opendkim
rm -rf /tmp/etc
```

Or just re-write the two seed files by hand:

```bash
cat > data/opendkim/SigningTable <<'EOF'
*@id.nextbestnetwork.com mail._domainkey.nextbestnetwork.com
*@example.com mail._domainkey.example.com
EOF
cat > data/opendkim/KeyTable <<'EOF'
mail._domainkey.nextbestnetwork.com nextbestnetwork.com:mail:/etc/opendkim/keys/nextbestnetwork.com/mail.private
mail._domainkey.example.com example.com:mail:/etc/opendkim/keys/example.com/mail.private
EOF
```

Optionally clear the Next build cache and stop the dev server:

```bash
rm -rf .next
```

---

## Reporting results

When you're done, either tick the boxes in this doc and push, or paste a summary (which sections passed vs. failed). If anything fails, the most useful info is:
- the section number
- what you expected vs what you saw
- the on-disk `data/opendkim/SigningTable` content at the moment of failure

Once everything green-lights, Phase 1 is signed off and we can re-review Phase 2 (KeyTable thin) per the plan's review gate.
