# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.2] - unreleased

### Added

- **Portable container image** — `APP_UID` / `APP_GID` moved from build-time
  ARGs to a runtime `su-exec` entrypoint. One published image now works on
  any host; the deployer sets `APP_UID` / `APP_GID` in env to match the host
  `opendkim` user rather than rebuilding.
- **`make release` automation** — runs the `dev → staging-strip → main` flow
  with precondition checks (on `dev`, clean tree, not behind `origin/dev`).
  Strips `docs/plans/` before merging so release history stays clean.
  `make release-abort` recovers from a failed run mid-flight.
- **Docker compose `make` targets** — `prod-build`, `prod-start`, `prod-stop`,
  `prod-logs`, `prod-rebuild` wrap the common `docker compose` invocations.
- **GHCR publish workflow** — on a published GitHub Release, CI builds a
  multi-arch (`linux/amd64` + `linux/arm64`) image and pushes to
  `ghcr.io/xalior/dkim-dashboard` with semver tags plus `latest`.

### Changed

- **Compose split** — renamed `docker-compose.yml` to `compose.yml` (modern
  Compose naming). The hosting compose now references the GHCR image directly;
  deployers pull `ghcr.io/xalior/dkim-dashboard:latest` and run with just
  `compose.yml` plus `.env` — no source tree needed. A new `compose.dev.yml`
  overlay swaps the image for a local build context.
- Makefile `prod-start`/`prod-stop`/`prod-logs` use `compose.yml` only
  (GHCR image). `prod-build`/`prod-rebuild` layer `compose.dev.yml` for
  local builds.
- `compose.yml` sources runtime app config via `env_file: .env`
  (optional). The three `OPENDKIM_*` container-internal paths remain
  hardcoded to match the volume mount targets.

## [0.1.1] - 2026-04-15

### Added

- **Signing Rules** — new top-level page at `/rules/signing` with list, add,
  edit, and delete actions. Each rule has a stable id that survives restarts
  so deep-links remain valid across dashboard sessions. Signing rules are now
  first-class and separate from domain records.
- **Key detail pages** — `/rules/keys/[id]` surfaces the expected DNS TXT
  record, on-disk key files, and a live DNS verification for a single key.
- **Trusted Hosts redesign** — per-entry pages at `/trusted-hosts/[id]` and
  `/trusted-hosts/new` replace the bulk-textarea editor. Inline `# comment`
  on each line is now read, preserved, and editable (the leading `#` is a
  storage detail and hidden from the UI).
- **Round-trip-safe config writers** — `SigningTable`, `KeyTable`, and
  `TrustedHosts` now round-trip through parser → writer without losing
  hand-edited comments, blank lines, `refile:` directives, or entries the
  dashboard does not recognise.
- **Atomic writes + in-process write lock** — every config mutation goes
  through a `tmp-then-rename` atomic write under a per-file async mutex.
  Safe against concurrent requests within one Node process; see the
  single-instance deployment note in the README for the multi-process caveat.
- **3-tier contextual help** — every management page now ships with an
  "About this page" panel, per-field tooltips, and per-row help drawers.
  Applied to Domains, Signing Rules, Keys, and Trusted Hosts.
- **New API surface**:
  - `GET/POST/PATCH /api/rules/signing` and
    `GET/PUT/DELETE /api/rules/signing/[id]` — signing rule CRUD and reorder.
  - `GET /api/rules/keys` and `GET /api/rules/keys/[id]` — key table listing
    and per-key detail (expected DNS record, disk files, live verification).
  - `GET/POST /api/trusted-hosts` and
    `GET/PUT/DELETE /api/trusted-hosts/[id]` — per-entry trusted host CRUD.
- **Structured JSON errors** — management routes return
  `{ error, message }` with codes `VALIDATION_ERROR` (400), `NOT_FOUND` (404),
  `DUPLICATE_ENTRY` (409), and `INTERNAL` (500).
- **Test tooling** — `vitest` wired up via `npm test` / `npm run test:watch`
  with a `Makefile` covering common dev tasks.
- **Release hygiene** — CI workflow blocks merges to `main` that still carry
  `docs/plans/` implementation notes.

### Changed

- `/keys` page rewritten against the new `/api/rules/keys` endpoint; each
  key row now links to its dedicated detail page.
- `/trusted-hosts` page rewritten from a bulk textarea to per-entry CRUD
  with a dedicated "new entry" flow.
- `/domains` page retrofitted with 3-tier help and wired to the narrow
  delete path below.
- `DELETE /api/domains` accepts an optional `ruleId` so a single signing
  rule can be removed when one domain is referenced by several rules.
- Trusted host values are rejected (400) if they contain whitespace or
  commas — add multiple entries one at a time.

### Removed

- `GET /api/keys` — superseded by `GET /api/rules/keys`. `POST /api/keys/generate`
  is unchanged.

### Fixed

- Inline-comment extraction for `TrustedHosts` entries is now robust against
  mid-line `#` separators and leading whitespace; comments round-trip
  correctly through every CRUD path.

## [0.1.0] - 2026-04-14

### Fixed

- Service reload now sends `SIGUSR1` instead of `SIGHUP` — `SIGUSR1` is the
  signal OpenDKIM uses to reload its key and signing tables; `SIGHUP` did not
  reliably pick up config changes.

### Changed

- Docker deployment guidance updated to mount OpenDKIM configuration under
  `/data/` for a secure-by-default container layout.
- README streamlined; full deployment detail moved to `docs/README.md`.
- Example data path corrected to `data/opendkim` (was `data/etc/opendkim`).

### Security

- Added a prominent notice that the application ships with **no built-in
  authentication or access control**. All endpoints are unrestricted and
  access must be enforced at the edge/ingress layer (nginx basic auth,
  reverse-proxy IP allowlist, VPN, etc.). Do not expose directly to the
  internet.

## [0.0.1] - 2026-04-02

### Added

- Initial project scaffolding with Next.js 16 and React-Bootstrap
- Core OpenDKIM management library (`lib/opendkim.ts`)
  - Parse and write `SigningTable`, `KeyTable`, and `TrustedHosts`
  - Pure TypeScript RSA-2048 DKIM key generation (no shell dependencies)
  - DNS record derivation from private keys on disk
  - Live DNS TXT record verification via `dns/promises`
  - Service reload via SIGHUP
- Dashboard overview page with domain counts and DNS health summary
- Domain management page with add, remove, and DNS record viewing
- Key management page with per-domain key regeneration
- Trusted hosts management page with add/remove and save
- Configuration viewer with tabbed view of `opendkim.conf`, `SigningTable`, `KeyTable`
- API routes for all management operations
- `.env`-based configuration for OpenDKIM paths
- Example OpenDKIM config data in `data/` for local development
- LGPLv3 license
