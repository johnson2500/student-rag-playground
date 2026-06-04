.PHONY: setup dev lint test test-integration test-e2e build deploy undeploy

HELM_RELEASE ?= student-rag-playground
HELM_NAMESPACE ?= student-rag-playground
HELM_CHART     := deploy/helm/student-rag-playground

# ── Setup ─────────────────────────────────────────────────────────────────────
setup:
	pnpm install
	cd packages/api && uv sync
	cd packages/db  && uv sync
	cp -n .env.example .env || true

# ── Local dev ─────────────────────────────────────────────────────────────────
dev:
	podman-compose up --build

dev-down:
	podman-compose down -v

# ── Lint ──────────────────────────────────────────────────────────────────────
lint:
	cd packages/api && uv run ruff check . && uv run ruff format --check .
	cd packages/db  && uv run ruff check . && uv run ruff format --check .
	pnpm --filter ui lint

fmt:
	cd packages/api && uv run ruff format .
	cd packages/db  && uv run ruff format .
	pnpm --filter ui fmt

# ── Tests ─────────────────────────────────────────────────────────────────────
test:
	cd packages/api && uv run pytest
	pnpm --filter ui test run

test-integration:
	docker compose -f compose.yml up -d db minio
	cd tests/integration && uv run pytest
	docker compose -f compose.yml down

test-e2e:
	pnpm --filter ui exec playwright test

# ── Build ─────────────────────────────────────────────────────────────────────
build:
	pnpm turbo run build

# ── Helm ─────────────────────────────────────────────────────────────────────
helm-lint:
	helm lint $(HELM_CHART)

deploy:
	helm upgrade --install $(HELM_RELEASE) $(HELM_CHART) \
	  --namespace $(HELM_NAMESPACE) --create-namespace \
	  -f $(HELM_CHART)/values.yaml

undeploy:
	helm uninstall $(HELM_RELEASE) --namespace $(HELM_NAMESPACE)
