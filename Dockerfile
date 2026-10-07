FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
COPY pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @seo-auditor/database db:generate
RUN pnpm build
CMD ["pnpm","--filter","@seo-auditor/api","start"]
