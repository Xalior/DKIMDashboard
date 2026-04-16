# Implementation: Compose split — GHCR image for hosting, local build for dev

**Status:** Complete
**Branch:** `dev`
**Plan:** `docs/plans/plan_compose-split.md`
**PR:** https://github.com/Xalior/DKIMDashboard/pull/7

## Preflight Decisions

- **PR strategy:** `from-start`
- **Comment trust minimum:** `write`
- **Baseline verification:** `make ci` — all green (114 tests, lint/typecheck clean, build succeeds)
- **In-flight labels created:** yes
- **Plan-deferred decisions:** none

## Tasks

- [x] Phase 1: Compose split and Makefile update

## Progress Log

- Phase 1 started: compose split and Makefile update
- Phase 1 automated criteria: all pass (make ci green, compose config validated both modes)
- Phase 1 manual criteria: `make prod-rebuild` builds locally and starts container — confirmed. `make prod-start` GHCR pull deferred until first release (no image published yet).

## Decisions & Notes

- Working directly on `dev` branch per user instruction (no feature branch).

## Blockers

## Last-seen Feedback State

- **Last-seen comment id:** none yet
- **Last-seen review id:** none yet
- **Last-seen check suite:** none yet
- **Ignored (below trust threshold):**

## Commits

- `3d57447` refactor: rename docker-compose.yml to compose.yml, use GHCR image
- `3c7d08f` feat: add compose.dev.yml overlay for local builds
- `b726888` refactor: update Makefile prod-* targets for layered compose
