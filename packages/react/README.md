# @page-use/react

React bindings for Page Use. Hooks and components that wire your React state to the Page Use conversation loop.

## Install

```bash
pnpm add @page-use/react @page-use/client
```

## Configuration

By default the client connects to `http://localhost:12001/trpc`. Point it at a
different server with `configure` from `@page-use/client`:

```ts
import {configure} from '@page-use/client';

configure({serverURL: 'https://my-server.com/trpc'});
```

Call `configure` once before rendering — typically in your entry file.

## Quick Start

```tsx
import {configure} from '@page-use/client';
import {SystemPrompt, useAgentVariable, useAgentFunction} from '@page-use/react';
import {PageUseChat} from '@page-use/react/ui/chat';
import {z} from '@page-use/react';

// point at your server (defaults to http://localhost:12001/trpc)
configure({serverURL: 'https://my-server.com/trpc'});

const itemsSchema = z.array(
    z.object({
        id: z.string(),
        text: z.string(),
        completed: z.boolean(),
    }),
);

const App = () => {
    const [items, setItems] = useState([]);

    useAgentVariable('items', {schema: itemsSchema, value: items});

    useAgentFunction('setItems', {
        inputSchema: itemsSchema,
        mutates: ['items'],
        func: async (newItems) => {
            setItems(newItems);
            return {ok: true};
        },
    });

    return (
        <>
            <SystemPrompt>
                You are helping the user manage a todo list.
            </SystemPrompt>

            <ul>
                {items.map((item) => (
                    <li key={item.id}>{item.text}</li>
                ))}
            </ul>

            <PageUseChat title="Assistant" theme="dark" />
        </>
    );
};
```

## Exports

### `@page-use/react`

| Export | Type | Description |
|--------|------|-------------|
| `SystemPrompt` | Component | Set the system prompt via `children` or `prompt` prop |
| `useSystemPrompt` | Hook | Set the system prompt imperatively |
| `useAgentVariable` | Hook | Expose React state as a readable variable |
| `useAgentFunction` | Hook | Expose a function the assistant can call |
| `useAgentState` | Hook | Combines variable + setter function in one call |

### `@page-use/react/ui/chat`

| Export | Type | Description |
|--------|------|-------------|
| `PageUseChat` | Component | Draggable chat widget with markdown, theming, and dev mode |

`PageUseChat` props:

- `title` — panel header (default `"Agent"`)
- `greeting` — initial assistant message
- `placeholder` — input placeholder text
- `suggestions` — clickable suggestion chips
- `theme` — `"dark"` or `"light"`
- `icon` — custom icon component
- `devMode` — show execution steps
- `cssVariables` — override theme colors (`--pu-bg`, `--pu-fg`, `--pu-accent`, etc.)
- `width` / `height` — panel dimensions (default `320` x `560`)

## License

MIT
