# Plan: Compose split — GHCR image for hosting, local build for dev

**Status:** Final
**Pre-plan:** `docs/plans/preplan_compose-split.md`

## Overview

Split the single `docker-compose.yml` into a hosting compose (`compose.yml`) that references the GHCR image and a dev overlay (`compose.dev.yml`) that swaps in a local build. Update Makefile targets to use the layered compose pattern.

## Current State

- Single `docker-compose.yml` with `build: context: .` — always requires a local build and source tree.
- Makefile `prod-*` targets call bare `docker compose` without explicit file flags.
- GHCR publish workflow already builds and pushes `ghcr.io/xalior/dkim-dashboard` with semver tags on release.

## Desired End State

- `compose.yml` references the GHCR image — a deployer copies this file plus `.env` and runs `docker compose up -d`. No source tree needed.
- `compose.dev.yml` overlays `build: context: .` for local development builds.
- Makefile targets use explicit `-f` flags: production targets use `compose.yml` only, rebuild/build targets layer `compose.dev.yml` on top.

## Key Discoveries

- `docker-compose.yml:9` — the `build: context: .` block is the only thing that needs to move to the dev overlay. All other config (volumes, env, pid, security_opt, container_name) is hosting config and stays in `compose.yml`.
- xal.io uses `image: !reset` in `compose.dev.yml` to clear the base image before setting `build:`. This is required because Compose merges overlay files — without `!reset`, both `image:` and `build:` would be set, which is ambiguous.
- xal.io Makefile uses variables (`COMPOSE := -f compose.yml`, `COMPOSE_DEV := $(COMPOSE) -f compose.dev.yml`) to keep targets DRY.

## What We're NOT Doing

- Dockerfile, entrypoint script — already done, no changes.
- `publish-image.yml` workflow — already done, no changes.
- `make release` / `make release-abort` — already done, no changes.
- `guard-prerelease-paths.yml` — already done, no changes.
- Redis or other sidecar service flavours (not applicable to this project).

## Approach

Single vertical slice — the three file changes are tightly coupled and form one logical, testable unit.

## Phase 1: Compose split and Makefile update

### Overview

Rename `docker-compose.yml` → `compose.yml` (GHCR image for hosting), create `compose.dev.yml` (local build overlay), update Makefile targets.

### Changes Required

**1. Rename `docker-compose.yml` → `compose.yml`**

Replace `build: context: .` (line 9–10) with `image: ghcr.io/xalior/dkim-dashboard:latest`. Everything else stays verbatim — the comment block, `container_name`, `ports`, `volumes`, `env_file`, `environment`, `pid`, `restart`, `security_opt`.

**2. Create `compose.dev.yml`**

```yaml
services:
  dkim-dashboard:
    image: !reset
    build:
      context: .
```

Minimal — clears the GHCR image and substitutes a local build. No env vars, no volumes, no other config.

**3. Update `Makefile`**

Add compose file variables after `STRIP_PATHS`:

```makefile
COMPOSE     := -f compose.yml
COMPOSE_DEV := $(COMPOSE) -f compose.dev.yml
```

Update `prod-*` targets:

| Target | Current | New |
|---|---|---|
| `prod-build` | `docker compose build` | `docker compose $(COMPOSE_DEV) build` |
| `prod-start` | `docker compose up -d` | `docker compose $(COMPOSE) up -d` |
| `prod-stop` | `docker compose down` | `docker compose $(COMPOSE) down` |
| `prod-logs` | `docker compose logs -f` | `docker compose $(COMPOSE) logs -f` |
| `prod-rebuild` | `docker compose up -d --build` | `docker compose $(COMPOSE_DEV) up -d --build` |

### Success Criteria

#### Automated

- `make ci` passes (lint, typecheck, test, build — no compose changes affect this, but confirms nothing broke).
- `docker compose -f compose.yml config` validates without errors and shows `image: ghcr.io/xalior/dkim-dashboard:latest` (no `build:` key).
- `docker compose -f compose.yml -f compose.dev.yml config` validates without errors and shows `build: context: .` (no `image:` key).

#### Manual

- `make prod-rebuild` builds the image locally and starts the container.
- Verify `compose.yml` alone is self-contained: copy it to a scratch directory with a `.env` file, run `docker compose up -d`, confirm it pulls from GHCR.

## Testing Strategy

Automated criteria can be run by the implementer immediately. The manual GHCR pull test requires at least one published release to exist in the registry (which it does — the workflow is already wired up).

## References

- xal.io reference implementation: `/Volumes/McFiver/u/GIT/xal.io/compose.yml`, `compose.dev.yml`, `Makefile`
- Current DKIMDashboard: `docker-compose.yml:9` (build block to move), `Makefile:28-41` (prod targets to update)
- GHCR image: `ghcr.io/xalior/dkim-dashboard`
