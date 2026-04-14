.PHONY: dev build start lint typecheck test test-watch ci

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
