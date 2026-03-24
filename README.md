
<p align="center">
    <img src="./docs/logo.svg" width="400" />
    <br/>
    <br/>
    <a href="https://github.com/page-use-people/page-use"><img alt="GitHub last commit" src="https://img.shields.io/github/last-commit/page-use-people/page-use"></a>
    <a href="https://github.com/page-use-people/page-use/issues"><img alt="GitHub Issues or Pull Requests" src="https://img.shields.io/github/issues/page-use-people/page-use"></a>
    <a href="https://npmjs.com/package/@page-use/react"><img src="https://img.shields.io/npm/v/@page-use/react.svg" alt="npm package"></a>
    <a href="https://hub.docker.com/r/pageuse/core"><img alt="Docker Image Size" src="https://img.shields.io/docker/image-size/pageuse/core"></a>
    <a href="https://github.com/page-use-people/page-use/blob/main/.github/workflows/release.yml"><img alt="GitHub Actions Workflow Status" src="https://img.shields.io/github/actions/workflow/status/page-use-people/page-use/release.yml"></a>
    <br/>
    <br/>
    An open-source SDK to add AI agents into any webapp.
</p>

<br/>

# page-use 📄 🤖

> **Beta** — the API is still unstable. Use in production at your own risk.

## Packages

| Package | Description | Links |
|---------|-------------|-------|
| `@page-use/react` | React hooks and chat widget | [npm](https://www.npmjs.com/package/@page-use/react) · [docs](./packages/react/README.md) |
| `@page-use/client` | TypeScript runtime | [npm](https://www.npmjs.com/package/@page-use/client) · [docs](./packages/client/README.md) |
| `@page-use/core` | Backend server | [Docker Hub](https://hub.docker.com/r/pageuse/core) · [docs](./apps/core/README.md) |

## Quick Start

### 1. Start the server

See the [core README](./apps/core/README.md) for the full `docker-compose.yml`.

```bash
ANTHROPIC_API_KEY=sk-ant-... docker compose up -d
```

### 2. Add to your React app

```bash
pnpm add @page-use/react @page-use/client
```

```tsx
import {configure} from '@page-use/client';
import {SystemPrompt, useAgentVariable, useAgentFunction} from '@page-use/react';
import {PageUseChat} from '@page-use/react/ui/chat';
import {z} from '@page-use/react';

// point at your server (defaults to http://localhost:12001/trpc)
configure({serverURL: 'https://my-server.com/trpc'});

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
