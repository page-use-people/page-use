# @page-use/core

Backend server that powers the Page Use conversation loop. Manages conversations, orchestrates AI-driven code execution, and exposes a tRPC API for client packages.

## Quick Start

Run with Docker Compose. Create a `docker-compose.yml`:

```yml
services:
  valkey:
    image: valkey/valkey:8.1.1
    restart: unless-stopped
    volumes:
      - valkey-data:/data

  postgres:
    image: postgres:17.4-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: "${POSTGRES_USER:-postgres}"
      POSTGRES_PASSWORD: "${POSTGRES_PASSWORD:-postgres}"
      POSTGRES_DB: "${POSTGRES_DB:-page_use}"
    volumes:
      - postgres-data:/var/lib/postgresql/data

  core:
    image: pageuse/core:latest
    restart: unless-stopped
    ports:
      - "${CORE_PORT:-12001}:12001"
    environment:
      DATABASE_URL: "postgresql://postgres:postgres@postgres:5432/page_use"
      REDIS_URL: "redis://valkey:6379"
      ANTHROPIC_API_KEY: "${ANTHROPIC_API_KEY}"
    depends_on:
      - postgres
      - valkey

volumes:
  valkey-data:
  postgres-data:
```

```bash
ANTHROPIC_API_KEY=sk-ant-... docker compose up -d
```

The server starts on port `12001` by default.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection URL |
| `REDIS_URL` | Yes | — | Redis / Valkey connection URL |
| `ANTHROPIC_API_KEY` | Yes | — | Anthropic API key |
| `JWT_SIGNING_KEY` | No | — | Secret for JWT token verification |
| `CORE_HOST` | No | `0.0.0.0` | Server bind address |
| `CORE_PORT` | No | `12001` | Server port |
| `NODE_ENV` | No | — | `development` or `production` |
| `POSTHOG_API_KEY` | No | — | PostHog analytics key |

## API

The server exposes a tRPC endpoint at `/trpc` and a REST health check at `/`.

| Procedure | Description |
|-----------|-------------|
| `health.check` | Health check |
| `conversation.getConversation` | Fetch conversation history by ID |
| `converse.converse` | Run a conversation turn — the main procedure that drives the agent loop |

`@page-use/client` provides a typed tRPC client via `createClient()` that connects to this server.

## License

MIT
