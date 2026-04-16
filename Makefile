.PHONY: dev build start lint typecheck test test-watch ci prod-build prod-start prod-stop prod-logs prod-rebuild release release-abort

STRIP_PATHS := docs/plans

COMPOSE     := -f compose.yml
COMPOSE_DEV := $(COMPOSE) -f compose.dev.yml

dev:
	npx next dev

build:
	npx next build

start:
	npx next start

lint:
	npx eslint .

typecheck:
	npx tsc --noEmit

test:
	npx vitest run

test-watch:
	npx vitest

ci: lint typecheck test build

prod-build:
	docker compose $(COMPOSE_DEV) build

prod-start:
	docker compose $(COMPOSE) up -d

prod-stop:
	docker compose $(COMPOSE) down

prod-logs:
	docker compose $(COMPOSE) logs -f

prod-rebuild:
	docker compose $(COMPOSE_DEV) up -d --build

release:
	@test "$$(git rev-parse --abbrev-ref HEAD)" = "dev" || { echo "error: must be on 'dev' to release (currently on $$(git rev-parse --abbrev-ref HEAD))"; exit 1; }
	@test -z "$$(git status --porcelain)" || { echo "error: working tree not clean — commit or stash first"; exit 1; }
	git fetch origin
	@git merge-base --is-ancestor origin/dev HEAD || { echo "error: local dev is behind origin/dev — pull first"; exit 1; }
	git checkout -B staging dev
	@if git ls-tree -r dev -- $(STRIP_PATHS)/ 2>/dev/null | grep -q .; then \
		git rm -r $(STRIP_PATHS); \
		git commit -m "chore: strip pre-release paths for release"; \
	else \
		echo "==> no tracked files under $(STRIP_PATHS)/ — nothing to strip"; \
	fi
	git checkout main
	git pull --ff-only origin main
	git merge --no-ff staging -m "release: merge staging into main"
	git push origin main
	git checkout dev
	git branch -D staging
	@echo ""
	@echo "==> released to main. 'git push origin dev' when you want to publish dev."

release-abort:
	@echo "==> aborting in-progress release"
	-@git merge --abort 2>/dev/null
	-@git checkout dev 2>/dev/null
	-@git branch -D staging 2>/dev/null
	@echo "==> back on dev, staging removed (if it existed)"
