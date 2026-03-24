
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

# page-use

> **Beta** — the API is still unstable. Use in production at your own risk.

## Demo

[![](https://static.airstate.dev/page-use-demo_todo-list_github_thumbnail.jpg)](https://youtu.be/BaOlb2ao1FQ)

## Features

- **Fast** — `page-use` writes and executes JS code, not raw tool use.
- **Tool Definitions Powered by [Zod](https://zod.dev/)** — Friendlier to read and write than JSON Schema.
- **Inspired by [WebMCP](https://webmcp.dev/)** — `page-use` aims to be fully compatible with WebMCP.
- **React Integration**
  - `<PageUseChat/>` — component for ready-made UI
  - `useAgentState()` — to expose state to page-use agent.
- Fully Opensource — MIT Licensed

## Packages

| Package | Description | Links |
|---------|-------------|-------|
| `@page-use/react` | React hooks and chat widget | [npm](https://www.npmjs.com/package/@page-use/react) · [docs](./packages/react/README.md) |
| `@page-use/client` | TypeScript runtime | [npm](https://www.npmjs.com/package/@page-use/client) · [docs](./packages/client/README.md) |
| `@page-use/core` | Backend server | [Docker Hub](https://hub.docker.com/r/pageuse/core) · [docs](./apps/core/README.md) |

## Quick Start

### 1. Start the server

First create a `.env` file with the following

```nginx configuration
# required
ANTHROPIC_API_KEY=sk-ant-...

# used for verification, but enter the same string as signing key
JWT_SIGNING_KEY=...
```

Download this [docker-compose.yml](https://github.com/page-use-people/page-use/blob/main/docs/docker-compose.yml)
file and start the server.

```bash
# DOWNLOAD docker-compose.yml
curl -s "https://raw.githubusercontent.com/page-use-people/page-use/refs/heads/main/docs/docker-compose.yml" -o docker-compose.yml

# START
docker compose up -d
```

### 2. Add to your React app

```bash
pnpm add @page-use/react @page-use/client
```

```tsx
import {configure} from '@page-use/client';
import {SystemPrompt, useAgentState, z} from '@page-use/react';
import {PageUseChat} from '@page-use/react/ui/chat';

configure({
    serverURL: 'https://[SELF HOSTED PAGE USER CORE ADDRESS]/trpc'
});

const itemsSchema = z.array(
    z.object({
        id: z.string(),
        text: z.string(),
      
        // .describe is very important to provide the agent with context
        due: z.string()
                .regex(/[0-9]{4}-[0-9]{2}-[0-9]{2}/)
                .describe('the date the task is due in YYYY-MM-DD format')
    })
).describe('all todo list items');

const App = () => {
    const [items, setItems] = useState([]);
    
    useAgentState('items', [items, setItems], {schema: itemsSchema});

    return (
        <>
            <SystemPrompt>
                You help the user manage a todo list.
            </SystemPrompt>
            
            <ul>
                {items.map((item) => <li key={item.id}>{item.text}</li>)}
            </ul>
            
            <PageUseChat title="Assistant" theme="dark" />
        </>
    );
};
```

> [!TIP]
> We are importing `z` (zod) from `@page-use/react` because we expect
> a certain version of zod (`>=4.0.0 & <5.0.0`); importing from our
> package ensure you are using a compatible version of Zod.

## Maintainers

<table>
    <tbody>
        <tr>
            <td align="center">
                <br/>
                <a href="https://github.com/imas234">
                    <img src="https://github.com/imas234.png" width="120"/>
                    <br/>
                    imas234
                </a>
                <br/>
                <br/>
            </td>
            <td align="center">
                <br/>
                <a href="https://github.com/tanvir001728">
                    <img src="https://github.com/tanvir001728.png" width="120"/>
                    <br/>
                    tanvir001728
                </a>
                <br/>
                <br/>
            </td>
            <td align="center">
                <br/>
                <a href="https://github.com/omranjamal">
                    <img src="https://github.com/omranjamal.png" width="120"/>
                    <br/>
                    omranjamal
                </a>
                <br/>
                <br/>
            </td>
        </tr>
    </tbody>
</table>

## Community Managers

<table>
    <tbody>
        <tr>
            <td align="center">
                <br/>
                <a href="https://www.linkedin.com/in/samiha-tahsin/">
                    <img src="https://github.com/samiha-tahsin.png" width="120"/>
                    <br/>
                    samiha-tahsin
                </a>
                <br/>
                <br/>
            </td>
        </tr>
    </tbody>
</table>

## License

MIT
