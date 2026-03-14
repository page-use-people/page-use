# rules

- Functional only, no OOP, no classes, `const` everywhere
- Prefix `T` on types, `I` on interfaces; prefer types over interfaces; no `any`
- Acronyms are all-uppercase or all-lowercase, never title-cased (`HTTP` not `Http`, `DB` not `Db`, `IP` not `Ip`)
- `Object.freeze()` + `readonly` for immutability; avoid mutations (no `.push()`)
- Small pure functions over large impure ones; `.map()` / `Promise.all()` / `Array.from()` over loops
- Ternaries over ifs (except early returns); always use curly braces on ifs

- pnpm only, pinned exact versions, same version across all apps
- All commands via `docker compose run --rm mono pnpm ...`
