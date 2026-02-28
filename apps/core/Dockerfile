FROM node:24.1.0-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

FROM base AS build
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/core/package.json apps/core/package.json
RUN pnpm install --frozen-lockfile
COPY apps/core/src/ apps/core/src/
COPY apps/core/tsconfig.json apps/core/tsconfig.json
RUN pnpm --filter @page-use/core build
RUN pnpm deploy --legacy --filter @page-use/core --prod /deploy

FROM node:24.1.0-bookworm-slim
WORKDIR /app
COPY --from=build /deploy ./
ENV NODE_ENV=production
EXPOSE 12001
CMD ["node", "dist/index.mjs"]
