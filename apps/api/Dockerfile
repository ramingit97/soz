# Söz API — production Dockerfile
# Build:  docker build -f apps/api/Dockerfile -t soz-api .
# Run:    docker run -p 3000:3000 --env-file apps/api/.env soz-api
#
# The image ships a BUNDLE, not TypeScript. Production used to boot through
# `tsx`, which meant a TS transformer in the hot path of every cold start and a
# devDependency doing load-bearing work in prod. `scripts/build.mjs` explains why
# the bundle is esbuild rather than plain tsc.

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ── build stage — full deps, produces apps/api/dist ──────────────────────────
FROM base AS build
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/content/package.json ./packages/content/
RUN pnpm install --frozen-lockfile --prod=false

COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm --filter @soz/api build

# ── prod-deps stage — runtime node_modules only ─────────────────────────────
FROM base AS proddeps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/content/package.json ./packages/content/
RUN pnpm install --frozen-lockfile --prod

# ── runtime stage ────────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=proddeps /app/node_modules ./node_modules
COPY --from=proddeps /app/apps/api/node_modules ./apps/api/node_modules
# The workspace packages are inlined into the bundle and never imported at
# runtime, but pnpm symlinked them into apps/api/node_modules — copy the manifests
# so those links do not dangle.
COPY --from=proddeps /app/packages ./packages
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY apps/api/package.json ./apps/api/

WORKDIR /app/apps/api
EXPOSE 3000

# Drop root. Nothing here writes to disk, so read-only ownership is enough.
USER node

# Migrate on boot, then serve. --enable-source-maps maps a production stack trace
# back to the TypeScript that produced it (build.mjs emits the .map files).
CMD ["sh", "-c", "node dist/db/migrate.js && node --enable-source-maps dist/index.js"]
