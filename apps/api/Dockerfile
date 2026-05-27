# syntax=docker/dockerfile:1.7
#
# AdGenius API — production image
# ---------------------------------------------------------------------------
# This is a MONOREPO Dockerfile. Build context MUST be the repo root, NOT
# apps/api. On Railway, leave "Root directory" blank (or set to "/") and set
# the env var RAILWAY_DOCKERFILE_PATH=apps/api/Dockerfile. See docs/DEPLOY.md.
# ---------------------------------------------------------------------------
FROM node:20-alpine AS base
WORKDIR /app
# Prisma needs libssl + libc6-compat on Alpine
RUN apk add --no-cache libc6-compat openssl

# ---- Stage 1: install ALL workspace deps (lockfile-only layer for cache) ----
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN npm ci

# ---- Stage 2: build (prisma generate + tsc) ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared
RUN npx -w apps/api prisma generate
RUN npm run build -w apps/api

# ---- Stage 3: slim runtime ----
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
# Copy the compiled output, the prisma schema (needed by @prisma/client at
# runtime to locate the engine binary), and the installed node_modules.
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./package.json
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 4000
# Use 0.0.0.0 by default — node 20 + helmet honor whatever Express binds to,
# which is all interfaces on platforms like Railway.
CMD ["node", "dist/index.js"]
