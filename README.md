# page-use

Monorepo for the core API and demos.

## Run

Create a real `.env` first.

Warning: [`.env.example`](/Users/sami/Documents/projects/page-use/page-use/.env.example#L1) contains host-style URLs:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/page_use
REDIS_URL=redis://localhost:6667
```

Those values work from your machine, but not from inside the `mono` container. If you run plain `docker compose up --build` with those values in `.env`, the app can start but internal service communication breaks:

- Redis in `mono` retries against `127.0.0.1:6667` and logs `ECONNREFUSED`
- DB and migration commands inside `mono` try `127.0.0.1:5433` instead of `postgres:5432`

`./dev.sh` detects that case and offers a one-command Docker-safe override. If you decline it, the command continues with your raw `.env` values.

Initialize the repo, run migrations if present, and start the full stack:

```bash
./dev.sh init
```

Run migrations separately:

```bash
./dev.sh run-migrations
```

If your `.env` still uses the example host URLs (`localhost:5433` / `localhost:6667`), `dev.sh` will warn and offer a one-command Docker-safe override.

Deep-clean local and Docker dev artifacts:

```bash
./dev.sh deep-clean
```

Ports:
- `12001` core
- `12002` todo demo
- `12003` color picker demo

## Conventions

- Use `pnpm` only.
- Run repo commands through Docker: `docker compose run --rm mono pnpm ...`
- Functional style only. No classes, no `any`.
- Types use `T` prefix. Prefer types over interfaces.
- Pure ESM: source files use `.mts`, imports use `.mjs`.
- Keep dependency versions pinned and aligned across packages.
