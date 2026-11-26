# KWOTA API / indexer / worker image (same image, different command)
#   docker build -t kwota-api .
#   docker run --env-file .env kwota-api                       # API (runs migrations)
#   docker run --env-file .env kwota-api pnpm --filter @kwota/api indexer
#   docker run --env-file .env kwota-api pnpm --filter @kwota/api worker
FROM node:22-slim
RUN corepack enable
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile --filter "@kwota/api..."
ENV NODE_ENV=production
EXPOSE 8787
CMD ["pnpm", "--filter", "@kwota/api", "start"]
