# ==============================================================================
# Zupit Multi-Stage Production Dockerfile (node:22-alpine, pnpm)
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Dependencies (deps)
# ------------------------------------------------------------------------------
FROM node:22.11.0-alpine3.20 AS deps

WORKDIR /app

# Install build dependencies for native compilation (e.g., argon2) on Alpine
RUN apk add --no-cache python3 make g++ libc6-compat

# Install pnpm and configure store directory
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@9
RUN pnpm config set store-dir /pnpm/store

# Copy package manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install dependencies using BuildKit pnpm store cache mount
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ------------------------------------------------------------------------------
# Stage 2: Build (build)
# ------------------------------------------------------------------------------
FROM node:22.11.0-alpine3.20 AS build

WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@9

# Copy installed dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json drizzle.config.ts tailwind.config.js ./
COPY index.html app.js style.css ./
COPY public ./public
COPY drizzle ./drizzle
COPY src ./src

# Build static assets (Vite client build -> dist/)
RUN pnpm run build

# ------------------------------------------------------------------------------
# Stage 3: Target Migrator (One-off Drizzle migration runner)
# ------------------------------------------------------------------------------
FROM node:22.11.0-alpine3.20 AS migrator

WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@9

# Copy dependencies and migration files
COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json drizzle.config.ts ./
COPY drizzle ./drizzle
COPY src/server/db ./src/server/db

USER node

ENTRYPOINT ["pnpm", "db:migrate"]

# ------------------------------------------------------------------------------
# Stage 4: Production Runner (runner)
# ------------------------------------------------------------------------------
FROM node:22.11.0-alpine3.20 AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apk add --no-cache libc6-compat && \
    npm install -g pnpm@9

# Setup directories required for read-only root compatibility & tmpfs mounts
RUN mkdir -p /app/.next/cache /app/public/uploads /tmp && \
    chown -R node:node /app /tmp

# Copy only standalone output, static files (dist), and public folder
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=build --chown=node:node /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build --chown=node:node /app/tsconfig.json ./tsconfig.json
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/src ./src
COPY --from=build --chown=node:node /app/index.html ./index.html
COPY --from=build --chown=node:node /app/app.js ./app.js
COPY --from=build --chown=node:node /app/style.css ./style.css

USER node

EXPOSE 3000

# Health check hitting /api/v1/health using Node.js fetch
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/v1/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["pnpm", "run", "server"]
