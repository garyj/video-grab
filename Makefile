.DEFAULT_GOAL := build

.PHONY: install
install: ## Install the dependencies pinned in pnpm-lock.yaml
	pnpm install --frozen-lockfile

.PHONY: build
build: install ## Compile src/ into dist/, the files Chrome loads
	pnpm build

.PHONY: check
check: install ## Type-check, then run the tests
	pnpm check
	pnpm test

.PHONY: clean
clean: ## Delete the build output
	rm -rf dist
