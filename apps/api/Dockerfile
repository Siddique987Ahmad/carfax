# syntax=docker/dockerfile:1
# Build from the repo root: docker build -f apps/api/Dockerfile -t carfax-api .

FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /repo
# Dependencies first, so this layer is cached until a package.json or the lockfile changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
RUN COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm install --frozen-lockfile --filter @carfax/api...
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/db packages/db
COPY apps/api apps/api
RUN pnpm --filter @carfax/api build
# Production dependencies only. The @carfax/* packages are already compiled into dist.
RUN pnpm --filter @carfax/api deploy --prod --legacy /out

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/apps/api/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s \
  CMD wget -qO- http://127.0.0.1:${PORT:-3000}/v1/health > /dev/null || exit 1
CMD ["node", "--enable-source-maps", "dist/main.js"]
