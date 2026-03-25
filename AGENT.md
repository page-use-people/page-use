# agent rules

- Keep this file lean and read it before running repo commands or editing code.
- Never run host-machine `pnpm` in this repo. Use `docker compose run --rm mono pnpm ...`
- Prefer demo-scoped pnpm commands like `pnpm --dir demos/<name> ...` and keep lockfile changes limited to the affected importer/package whenever possible.
- Keep package versions pinned exactly and aligned across apps.
- Functional only, no classes, `const` everywhere, no `any`
- Prefer immutable data and small pure functions
