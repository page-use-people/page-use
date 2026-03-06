#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXAMPLE_DATABASE_URL="postgresql://postgres:postgres@localhost:5433/page_use"
EXAMPLE_REDIS_URL="redis://localhost:6667"
DOCKER_DATABASE_URL="${DOCKER_DATABASE_URL:-postgresql://postgres:postgres@postgres:5432/page_use}"
DOCKER_REDIS_URL="${DOCKER_REDIS_URL:-redis://valkey:6379}"
USE_DOCKER_ENV_OVERRIDE=0

cd "$ROOT_DIR"

require_env_file() {
    if [ ! -f .env ]; then
        echo "Missing .env."
        echo "Create it explicitly before running this command."
        echo "Do not copy .env.example unchanged if you want plain docker compose commands to work inside containers."
        exit 1
    fi
}

read_env_value() {
    local key="$1"
    local file="$2"
    local line

    line="$(grep -E "^${key}=" "$file" | tail -n 1 || true)"
    printf '%s' "${line#*=}"
}

maybe_enable_docker_env_override() {
    local database_url
    local redis_url

    USE_DOCKER_ENV_OVERRIDE=0
    database_url="$(read_env_value DATABASE_URL .env)"
    redis_url="$(read_env_value REDIS_URL .env)"

    if [ "$database_url" != "$EXAMPLE_DATABASE_URL" ] && [ "$redis_url" != "$EXAMPLE_REDIS_URL" ]; then
        return 0
    fi

    echo "Warning: one or more .env connection values still match .env.example."
    echo "Those host-style URLs work from your machine, but not from inside the mono container."
    echo "This helper can override them for this command only:"
    echo "  DATABASE_URL=$DOCKER_DATABASE_URL"
    echo "  REDIS_URL=$DOCKER_REDIS_URL"

    read -r -p "Use the Docker-safe override for this command? [y/N] " CONFIRM_OVERRIDE

    if [[ "$CONFIRM_OVERRIDE" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        USE_DOCKER_ENV_OVERRIDE=1
        return 0
    fi

    echo "Continuing without override."
}

has_migrations() {
    find apps/core/migrations -maxdepth 1 -type f -print -quit | grep -q .
}

wait_for_postgres() {
    echo "Waiting for Postgres..."

    until docker compose exec -T postgres sh -lc 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; do
        sleep 1
    done
}

run_mono_command() {
    if [ "$USE_DOCKER_ENV_OVERRIDE" -eq 1 ]; then
        DATABASE_URL="$DOCKER_DATABASE_URL" REDIS_URL="$DOCKER_REDIS_URL" docker compose run --build --rm mono "$@"
        return 0
    fi

    docker compose run --build --rm mono "$@"
}

run_compose_up() {
    if [ "$USE_DOCKER_ENV_OVERRIDE" -eq 1 ]; then
        exec env DATABASE_URL="$DOCKER_DATABASE_URL" REDIS_URL="$DOCKER_REDIS_URL" docker compose up --build
    fi

    exec docker compose up --build
}

run_migrations() {
    docker compose up -d postgres valkey

    if ! has_migrations; then
        echo "No migration files found in apps/core/migrations"
        return 0
    fi

    wait_for_postgres
    run_mono_command pnpm --filter @page-use/core run db:migrate:latest
}

run_deep_clean() {
    read -r -p "This will remove Docker volumes and local install/build artifacts. Continue? [y/N] " CONFIRM_CLEAN

    if [[ ! "$CONFIRM_CLEAN" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo "Aborted."
        exit 1
    fi

    read -r -p "Type DEEP-CLEAN to confirm: " CONFIRM_DEEP_CLEAN

    if [[ "$CONFIRM_DEEP_CLEAN" != "DEEP-CLEAN" ]]; then
        echo "Aborted."
        exit 1
    fi

    docker compose down -v --remove-orphans || true
    find . -type d \( -name node_modules -o -name .turbo -o -name .pnpm-store \) -prune -exec rm -rf {} +
}

print_usage() {
    cat <<'EOF'
Usage: ./dev.sh <command>

Commands:
  init            Install dependencies, run migrations if present, and start the stack
  run-migrations  Run database migrations if present
  deep-clean      Remove Docker volumes and local install/build artifacts
EOF
}

COMMAND="${1:-}"

case "$COMMAND" in
    init)
        require_env_file
        maybe_enable_docker_env_override
        run_mono_command pnpm install
        run_migrations
        run_compose_up
        ;;
    run-migrations)
        require_env_file
        maybe_enable_docker_env_override
        run_migrations
        ;;
    deep-clean)
        run_deep_clean
        ;;
    help|-h|--help|'')
        print_usage
        ;;
    *)
        echo "Unknown command: $COMMAND" >&2
        print_usage >&2
        exit 1
        ;;
esac
