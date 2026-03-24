# @page-use/client

TypeScript runtime for wiring page state, page functions, and the Page Use conversation loop together.

## Install

```bash
pnpm add @page-use/client
```

## Configuration

By default the client connects to `http://localhost:12001/trpc`. Point it at a
different server with `configure`:

```ts
import {configure} from '@page-use/client';

configure({serverURL: 'https://my-server.com/trpc'});
```

Call `configure` once before `run` — typically at app startup.

## Quick Start

```ts
import {
    configure,
    registerFunction,
    run,
    setSystemPrompt,
    setVariable,
} from '@page-use/client';
import {z} from '@page-use/client';

// point at your server (defaults to http://localhost:12001/trpc)
configure({serverURL: 'https://my-server.com/trpc'});

// describe the assistant's role
setSystemPrompt('You are helping the user manage a todo list.');

// expose state the assistant can read
setVariable('items', {
    schema: z.array(
        z.object({
            id: z.string(),
            text: z.string(),
            completed: z.boolean(),
        }),
    ),
    value: [],
});

// expose a function the assistant can call
registerFunction('setItems', {
    inputSchema: z.array(
        z.object({
            id: z.string(),
            text: z.string(),
            completed: z.boolean(),
        }),
    ),
    mutates: ['items'],
    func: async (items) => {
        updateItemsInYourApp(items);
        return {ok: true};
    },
});

// run a conversation turn
const handle = run('Add "buy milk" to the list', {
    onMessage: (message) => console.log('assistant:', message),
    onUpdate: (update) => console.log('update:', update),
    onError: (error) => console.error('error:', error),
});

await handle.done;
```

## API

### Context

| Export | Description |
|--------|-------------|
| `setSystemPrompt(prompt)` | Set the system prompt for the assistant |
| `setContextInformation(key, {title?, content})` | Add extra context sent with each turn |
| `unsetContextInformation(key)` | Remove a context entry |
| `resetConversation()` | Start a fresh conversation (new ID) |

### Variables

| Export | Description |
|--------|-------------|
| `setVariable(name, {schema, value})` | Register a readable variable with a Zod schema |
| `unsetVariable(name)` | Remove a variable |

### Functions

| Export | Description |
|--------|-------------|
| `registerFunction(name, options)` | Register a callable function with Zod-validated I/O |
| `unregisterFunction(name)` | Remove a function |

`registerFunction` options:

- `inputSchema` — Zod schema for the input
- `outputSchema` — Zod schema for the output (optional)
- `mutates` — variable names this function changes (triggers automatic wait)
- `mutationTimeoutMs` — max wait time for declared mutations (default `5s`)
- `func(input, signal?)` — the handler

### Runner

| Export | Description |
|--------|-------------|
| `run(prompt, options?)` | Start a conversation turn (single-flight) |

`run` returns a `TRunHandle` with `abort()` and `done: Promise<void>`.

### Configuration

| Export | Description |
|--------|-------------|
| `configure(options)` | Set global config (e.g. `serverURL`). Call once before `run`. |

### Client

| Export | Description |
|--------|-------------|
| `createClient(options?)` | Create a typed tRPC client to the core service |

### Types

`TRunHandle`, `TRunOptions`, `TRunStatus`, `TRunUpdate`, `TFunctionOptions`, `TVariableOptions`

## License

MIT
