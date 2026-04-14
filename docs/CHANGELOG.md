# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
