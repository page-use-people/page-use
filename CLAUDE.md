# page-use

Monorepo: `core` (tRPC/Express backend).

## Quick Rules

- Functional only, no OOP, no classes, `const` everywhere
- Prefix `T` on types, `I` on interfaces; prefer types over interfaces; no `any`
- Acronyms are all-uppercase or all-lowercase, never title-cased (`HTTP` not `Http`, `DB` not `Db`, `IP` not `Ip`)
- Ternaries over ifs (except early returns); always use curly braces on ifs
- Small pure functions over large impure ones; `.map()` / `Promise.all()` / `Array.from()` over loops
- `Object.freeze()` + `readonly` for immutability; avoid mutations (no `.push()`)
- Always run prettier after changes (`bracketSpacing:false`, `singleQuote:true`, `trailingComma:'all'`, `tabWidth:4`)

## Architecture

- Services factory (`createServices()`) -> context factory (`createContextCreator()`) -> tRPC procedures
- Pure ESM (`.mts` files), `#core/*` import alias, imports use `.mjs` extension
- Three-tier caching: local memory -> Redis -> DB/API
- Anthropic Messages API with rate limiting (Bottleneck) and SHA256-based caching

## Database

- Kysely + auto-generated types + Zod validation
- ID pipeline: `uuidv7()` -> base32 (25 char) -> DB UUID -> jumbled for display
- Enum const arrays as single source of truth for types + Zod schemas
- `Selectable`/`Insertable`/`Updateable` type triples per table
- Run migrations: `pnpm --filter @page-use/core run db:migrate:latest`
- Always run `db:generate` after running a migration

## Events & Queues

- mitt emitter + Redis pub/sub bridge for real-time events
- Event definition pattern: `PREFIX`, `buildChannel(id)`, `buildPayload(...)`, `serializePayload()`
- Subscribe before publish to prevent race conditions

## Infrastructure

- pnpm only, pinned exact versions, same version across all apps
- All commands via `docker compose run --rm mono pnpm ...`
- Docker: extended syntax, pinned images, env override pattern `"${EXTERNAL_ENV:-default_value}"`
- Single `mono` service runs all apps via Turbo

## API

- tRPC with Zod input validation and protected procedures for auth
- JWT auth: Bearer token -> `jwtVerify()` -> userId extraction
- Context narrowing in middleware: non-null types downstream of auth guards
- `TAppRouter` exported for end-to-end type safety
- SSE transport enabled for tRPC subscriptions

## Gotchas

- mitt nodenext workaround, `emitter.on()` returns void, ioredis subscriber mode separation
- ESM imports use `.mjs` (compiled output), not `.mts` (source)
- Same dependency version must match across all package.json files
