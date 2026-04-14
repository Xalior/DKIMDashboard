# Local test plan — Phase 3 TrustedHosts first-class

**Target:** `feature/trustedhosts-first-class` on a local dev box (lucy) **without** a running `opendkim` service. Builds on Phase 1 + 2 sign-off. Real-mail / DNS / opendkim-reload checks are out of scope.

## 0. Prerequisites

- `.env.local` with `OPENDKIM_CONFIG_DIR=./data/opendkim`.
- Seed data present. If missing, restore from the bundled tarball:
  ```bash
  rm -rf data/opendkim
  tar -xzf data/opendkim_conf.tar.gz -C /tmp
  mv /tmp/etc/opendkim data/opendkim
  rm -rf /tmp/etc
  ```
- Branch: `git checkout feature/trustedhosts-first-class`.

## 1. Static checks

```bash
make ci     # lint → typecheck → test → build
```

Expected:
- [ ] `make lint` — no output
- [ ] `make typecheck` — no output
- [ ] `make test` — **111 passed** across 11 files (adds 19 trusted-hosts + 16 trusted-hosts API handler tests on top of Phase 2's 76)
- [ ] `make build` — succeeds; route list includes `/api/trusted-hosts/[id]`, `/trusted-hosts/[id]`, `/trusted-hosts/new`

## 2. Start the dev server

```bash
pnpm dev
```

Tail the file under test in a second terminal:

```bash
watch -n 0.5 'cat data/opendkim/TrustedHosts'
```

## 3. Baseline — /trusted-hosts rewritten

Click **Trusted Hosts** in the navbar.

Checks:
- [ ] Page header has: title, "About this page", Refresh, **Add Trusted Host** (primary).
- [ ] Table columns: `Value`, `Inline comment`, `Actions`. Each header has a `[?]` level-2 help button.
- [ ] The Value column's `[?]` opens a combined modal stacking IP / CIDR / Hostname / refile: help.
- [ ] The seed row `0.0.0.0/0` is listed with an em-dash in the inline-comment column.
- [ ] Each row has Edit (pencil) and Delete (trash) buttons.
- [ ] The old "Save Changes" dirty-flag button is gone entirely.

## 4. About this page modal

Click **About this page**.

Checks:
- [ ] Level-3 copy covers: entry kinds, OpenDKIM's dual-role usage, order-doesn't-matter, inline-comment preservation on edit, hand-edit survival.

## 5. Add a plain entry

Click **Add Trusted Host**. URL is `/trusted-hosts/new`.

Fill:
- Value: `10.0.0.0/8`
- Inline comment: (leave blank)

Submit.

Checks:
- [ ] Redirected to `/trusted-hosts`.
- [ ] New row appears at the bottom (`10.0.0.0/8`), no inline-comment.
- [ ] `data/opendkim/TrustedHosts` now has the new line.
- [ ] Original `0.0.0.0/0` line is unchanged byte-for-byte.

## 6. Add an entry with an inline comment

Click **Add Trusted Host**.
Fill:
- Value: `127.0.0.1`
- Inline comment: `loopback` (no leading `#`)

Submit.

Checks:
- [ ] Redirect back. New row shows `127.0.0.1` + `# loopback` in the inline-comment column.
- [ ] On disk: the line is `127.0.0.1 # loopback` (leading `#` was added for you).
- [ ] The form's inline-comment behaviour is documented in the field help text.

## 7. Deep-link to edit + edit value only (inline comment preserved)

Click the pencil on the `127.0.0.1` row. URL shape: `/trusted-hosts/<id>`. Copy the URL.

Change Value to `::1`, leave inline comment as-is (`# loopback`). Save.

Checks:
- [ ] Redirected to list.
- [ ] Row now shows `::1` with `# loopback` preserved.
- [ ] On disk: `::1 # loopback`.
- [ ] Paste the copied URL into a fresh private window → lands on a **"Trusted host not found"** page (id changed on save — plan-verbatim honest-URL behaviour).
- [ ] Click the "Back to Trusted Hosts" button on the not-found page. Works.

## 8. Edit — drop the inline comment

Click the pencil on the `::1` row. Clear the inline-comment field. Save.

Checks:
- [ ] On disk: line is now `::1` (no trailing comment).
- [ ] Other entries byte-for-byte unchanged.

## 9. Edit — replace the inline comment

Click the pencil on the `::1` row. Set Value to `::1`, inline comment to `ipv6 localhost`. Save.

Checks:
- [ ] On disk: `::1 # ipv6 localhost` (leading `#` added).
- [ ] The row in the list reflects the new comment.

## 10. Refile: directive

Click **Add Trusted Host**. Value: `refile:/etc/opendkim/IgnoreHosts`. No inline comment. Submit.

Checks:
- [ ] Row renders with a blue `refile` badge.
- [ ] On disk: line preserved byte-for-byte.
- [ ] Deep-link to that row's edit page → the `refile` badge appears next to the "Edit trusted host" heading.

## 11. Hand-edit preservation across CRUD

Hand-add a block comment to the file:

```bash
sed -i.bak '1i\
# Hand-added comment above the first entry\
' data/opendkim/TrustedHosts
rm data/opendkim/TrustedHosts.bak
cat data/opendkim/TrustedHosts
```

In the UI, Refresh.

Checks:
- [ ] Comment is **not** rendered as a row (it's attached as leading to the entry below).
- [ ] Subsequent rows render correctly.

Now add a new entry via the UI (e.g. `192.168.1.0/24`).

Checks:
- [ ] New entry appears in the list.
- [ ] `# Hand-added comment above the first entry` is **still present** at the top of the file, byte-for-byte.

Delete a different entry via the UI.

Checks:
- [ ] Hand-added top comment is **still present**.
- [ ] Entries the hand-added comment wasn't attached to are unaffected.

## 12. Duplicate guard (409)

Click **Add Trusted Host**, Value: `0.0.0.0/0` (or whatever's already on line 1). Submit.

Checks:
- [ ] The form does not redirect. Red dismissible Alert appears with a `Duplicate trusted-host…` message.
- [ ] On disk: no new line was added.

## 13. Validation (400)

On the Add page, submit with Value empty.

Checks:
- [ ] HTML5 validation blocks submission (the Add button is disabled when Value is empty).
- [ ] In DevTools → Network, `fetch('/api/trusted-hosts', { method: 'POST', body: JSON.stringify({}) })` returns **400** with `{ error: 'VALIDATION_ERROR', message: '...' }`.

## 14. Delete + leading-block removal

Delete the `192.168.1.0/24` row you added in step 11.

Checks:
- [ ] Row gone from the list.
- [ ] If this row had a preceding comment, the comment goes with it (leading-block removal).
- [ ] Other entries byte-for-byte unchanged.

## 15. Keyboard / a11y spot check

On `/trusted-hosts/new`:
- [ ] Tab cycles: Value → Inline comment → Add button. Focus rings visible.
- [ ] Tooltips announce on focus (`aria-describedby` wired).
- [ ] Enter on a `[?]` opens the modal; Esc closes it.

## 16. Teardown

```bash
rm -rf data/opendkim
tar -xzf data/opendkim_conf.tar.gz -C /tmp
mv /tmp/etc/opendkim data/opendkim
rm -rf /tmp/etc
rm -rf .next
```

---

## Reporting results

Tick inline or summarise pass/fail. Once green-lit, Phase 3 ships and the three-phase plan is done. Phase 4 (pre-plan) covers the remaining work: KeyTable R/W editor + DKIM debugging UI + full UI-layer test-suite rollout.
