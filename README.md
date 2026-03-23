# page-use

An open-source SDK to add AI agents into any webapp.

> **Beta** — the API is still unstable. Use in production at your own risk.

## Packages

| Package | Description | Links |
|---------|-------------|-------|
| `@page-use/react` | React hooks and chat widget | [npm](https://www.npmjs.com/package/@page-use/react) · [docs](./apps/react/README.md) |
| `@page-use/client` | TypeScript runtime | [npm](https://www.npmjs.com/package/@page-use/client) · [docs](./apps/client/README.md) |
| `@page-use/core` | Backend server | [Docker Hub](https://hub.docker.com/r/pageuse/core) · [docs](./apps/core/README.md) |

## Quick Start

### 1. Start the server

See the [core README](./apps/core/README.md) for the full `docker-compose.yml`.

```bash
ANTHROPIC_API_KEY=sk-ant-... docker compose up -d
```

### 2. Add to your React app

```bash
pnpm add @page-use/react @page-use/client react react-dom zod
```

```tsx
import {SystemPrompt, useAgentVariable, useAgentFunction} from '@page-use/react';
import {PageUseChat} from '@page-use/react/ui/chat';
import {z} from 'zod';

const itemsSchema = z.array(z.object({id: z.string(), text: z.string(), completed: z.boolean()}));

const App = () => {
    const [items, setItems] = useState([]);

    useAgentVariable('items', {schema: itemsSchema, value: items});
    useAgentFunction('setItems', {
        inputSchema: itemsSchema,
        mutates: ['items'],
        func: async (next) => { setItems(next); return {ok: true}; },
    });

    return (
        <>
            <SystemPrompt>You help the user manage a todo list.</SystemPrompt>
            {items.map((item) => <div key={item.id}>{item.text}</div>)}
            <PageUseChat title="Assistant" theme="dark" />
        </>
    );
};
```

## License

MIT
