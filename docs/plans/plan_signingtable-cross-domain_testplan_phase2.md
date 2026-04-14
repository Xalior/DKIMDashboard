# Local test plan — Phase 2 KeyTable + Domains extras

**Target:** `feature/keytable-thin` on a local dev box (nancy) **without** a running `opendkim` service. Builds on the Phase 1 testplan — Phase 1's sign-off is a prerequisite here. Real-mail / DNS / opendkim-reload checks are out of scope.

## 0. Prerequisites

- `.env.local` with `OPENDKIM_CONFIG_DIR=./data/opendkim` (same as Phase 1).
- Seed data at `data/opendkim/SigningTable` + `data/opendkim/KeyTable`. If they don't exist, restore from the bundled tarball:
  ```bash
  rm -rf data/opendkim
  tar -xzf data/opendkim_conf.tar.gz -C /tmp
  mv /tmp/etc/opendkim data/opendkim
  rm -rf /tmp/etc
  ```
- Branch checked out: `git checkout feature/keytable-thin`.

## 1. Static checks

```bash
make ci     # lint → typecheck → test → build
```

Expected:
- [ ] `make lint` — no output
- [ ] `make typecheck` — no output
- [ ] `make test` — **76 passed** across 8 files (22 signing-table + 18 key-table + 10 primitives + 26 API handler tests)
- [ ] `make build` — succeeds; route list includes `/api/rules/keys`, `/api/rules/keys/[id]`, `/rules/keys/[id]`, and **does not** include `/api/keys` (removed)

## 2. Start the dev server

```bash
pnpm dev
```

Keep terminals tailing both files:

```bash
watch -n 0.5 'cat data/opendkim/SigningTable ; echo ---KEY--- ; cat data/opendkim/KeyTable'
```

## 3. Baseline — /keys page rewritten

Click **Keys** in the navbar.

Checks:
- [ ] Table columns: `selectorDomain`, `Domain`, `Selector`, `Key path`, `Actions`. Each header has a `[?]` level-2 help button.
- [ ] Rows match what's in `data/opendkim/KeyTable` (canonical entries show all four data columns).
- [ ] Each row has a **View details** (eye icon) and **Regenerate** button. Regenerate is hidden for malformed rows (none yet).
- [ ] "About this page" button in the header opens the level-3 `KeyEntriesPageHelp` modal.

## 4. Malformed entry surfacing

Hand-add a non-canonical line to the KeyTable:

```bash
printf '\nweirdSelector arbitrary:content\n' >> data/opendkim/KeyTable
```

In the UI, hit **Refresh**.

Checks:
- [ ] A new row appears with a yellow **non-standard entry** badge.
- [ ] The row spans the data columns and shows the raw line (`weirdSelector arbitrary:content`) as `<code>`.
- [ ] The row has **View details** (eye) but **no Regenerate** button.
- [ ] Clicking the inline `[?]` next to the badge opens `MalformedEntryHelp`.

## 5. Key entry detail — canonical

Click the eye on one of the canonical rows (e.g. `nextbestnetwork.com`).

Checks:
- [ ] URL shape is `/rules/keys/<12-char-id>`.
- [ ] **Entry** card shows selectorDomain / Domain / Selector / Key path, each with a `[?]` help button.
- [ ] **Key files on disk** card lists the files under `keys/<domain>/` (may show `mail.private` and `mail.txt`, or "No files found" if you haven't added this domain locally — both are valid).
- [ ] **DNS** card shows a status badge (most likely **No key on disk** or **Not in DNS** on a dev box) and the expected TXT value (if derivable).
- [ ] **About this page** renders `KeyEntriesPageHelp`. Back link returns to `/keys`.

## 6. Key entry detail — malformed

Click the eye on the hand-added `weirdSelector` row.

Checks:
- [ ] URL is `/rules/keys/<id>`.
- [ ] Only one card renders: a yellow "non-standard entry" header + raw-line `<pre>` + explanation.
- [ ] No disk-files or DNS cards.
- [ ] Inline `[?]` opens `MalformedEntryHelp`.

## 7. Deep-link

Copy the URL of a canonical detail page, open in a fresh private window.

Checks:
- [ ] Page lands directly on the detail view for that entry — no round-trip via `/keys`.
- [ ] Navbar **Keys** link shows as active.

## 8. Regenerate still works + hand-edits survive

On `/keys`, click **Regenerate** on a canonical row (pick one that has a private key file on disk — e.g. `nextbestnetwork.com`). Confirm the modal.

Checks:
- [ ] Regenerate succeeds, the follow-up modal shows the new BIND TXT record.
- [ ] The hand-added `weirdSelector arbitrary:content` line from step 4 is **still present** byte-for-byte in `data/opendkim/KeyTable` afterwards.
- [ ] `data/opendkim/keys/<domain>/mail.private` has a fresh timestamp; the `.txt` file alongside has a new public key.

## 9. /domains help retrofit

Click **Domains** in the navbar.

Checks:
- [ ] "About this page" button next to Refresh / Add Domain opens `DomainsPageHelp` (level-3).
- [ ] Each column header has a `[?]` button (Domain / From Pattern / Selector / DNS Status). Each opens its level-2 atom.
- [ ] Click **Add Domain** — form labels each have a `[?]`; hovering the inputs shows tooltips. Cancel the modal.

## 10. Narrow delete — two rules, delete one

Set up two rules referencing the same `(domain, selector)`:

1. On `/domains`, Add Domain: `domain = narrow.test`, `selector = mail`, `fromPattern = *@narrow.test`. Submit.
2. Go to `/rules/signing`, click **Add Rule**: `pattern = *@alias.narrow.test`, `keyRef = mail._domainkey.narrow.test`. Submit.

Both rules now point at `mail._domainkey.narrow.test`. Verify:

- [ ] `data/opendkim/SigningTable` contains two lines for `mail._domainkey.narrow.test`.
- [ ] `data/opendkim/KeyTable` contains exactly one line for `mail._domainkey.narrow.test`.
- [ ] `/domains` lists two rows for `narrow.test` (one per rule).

Now delete the `*@narrow.test` rule via `/domains` (the **trash** icon on the first of the two rows).

Checks:
- [ ] The confirmation modal copy says **"Remove this signing rule"** (not "Remove Domain") and shows the exact `pattern keyRef` it's about to remove.
- [ ] After confirming: the deleted row is gone, but the other row (`*@alias.narrow.test → mail._domainkey.narrow.test`) is still present.
- [ ] `data/opendkim/SigningTable` — only one rule remains for `mail._domainkey.narrow.test`.
- [ ] `data/opendkim/KeyTable` — the entry is **still there** (key is still in use by the surviving rule).
- [ ] `data/opendkim/keys/narrow.test/mail.private` and `mail.txt` still exist.

## 11. Narrow delete — removing the last rule

Delete the remaining `*@alias.narrow.test` rule via `/domains`.

Checks:
- [ ] Row is gone from `/domains` and `/rules/signing`.
- [ ] `data/opendkim/SigningTable` — no rules remain for `mail._domainkey.narrow.test`.
- [ ] `data/opendkim/KeyTable` — the entry for `mail._domainkey.narrow.test` is now **removed** (last reference gone).
- [ ] `data/opendkim/keys/narrow.test/*` files are **still on disk** (never auto-deleted, per confirmation copy).

## 12. Hand-edit preservation across delete + narrow-delete

Hand-add a comment above an entry:

```bash
# Before these operations: pick one remaining KeyTable line to edit
# e.g. add a leading comment above the example.com line
```

Use the UI to exercise Add Domain and Delete Domain with the narrow-delete flow.

Checks:
- [ ] Hand-added comments in **SigningTable** survive every UI add/delete.
- [ ] Hand-added comments in **KeyTable** survive every UI add/delete — including the deletion of the last rule referencing a key (the comment's host entry gets removed, but unrelated comments / entries stay put).
- [ ] The hand-added `weirdSelector arbitrary:content` line from step 4 has survived everything in this test so far.

## 13. Keyboard / a11y spot check

On `/domains`, Add Domain modal:
- [ ] Tab cycles through Domain → Selector → From Pattern.
- [ ] VoiceOver / ChromeVox announces each input's tooltip content when focused (`aria-describedby` is wired).

On `/rules/keys/[id]`:
- [ ] Tab reaches every `[?]` help button.
- [ ] Enter on a `[?]` opens the modal; Esc closes it.

## 14. Teardown

```bash
rm -rf data/opendkim
tar -xzf data/opendkim_conf.tar.gz -C /tmp
mv /tmp/etc/opendkim data/opendkim
rm -rf /tmp/etc
rm -rf .next
```

---

## Reporting results

Tick the boxes inline or summarise pass/fail. If anything fails, include:
- section number
- expected vs observed
- on-disk state of `data/opendkim/SigningTable` and `data/opendkim/KeyTable` at the moment of failure

Once green-lit, Phase 2 ships and the Phase 3 re-review (TrustedHosts) starts.
