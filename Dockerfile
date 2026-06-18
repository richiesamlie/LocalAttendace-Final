# syntax=docker/dockerfile:1.7
# Multi-stage Dockerfile for the Teacher Assistant app.
# Stage 1: builder — compiles the frontend (Vite) so we only ship the
#          static assets in the production image.
# Stage 2: production — minimal runtime, non-root user, health check.

# ----------------------------------------------------------------------------
# Stage 1: builder
# ----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for better layer caching.
# --ignore-scripts: skip lifecycle scripts during install (defense in depth;
#                   we don't run postinstall hooks in CI anyway).
# --no-audit / --no-fund: faster, quieter builds.
COPY package*.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund

# Copy source code and build the app.
COPY . .
RUN npm run build

# ----------------------------------------------------------------------------
# Stage 2: production
# ----------------------------------------------------------------------------
FROM node:20-alpine

# F-028 hardening:
#   - Pin npm to a specific version that includes recent security fixes
#     (upgraded at build time rather than relying on base image version).
#   - Use --ignore-scripts on production install too (no postinstall hooks).
#   - --no-audit / --no-fund: don't leak info or hit npm registry at runtime.
#   - Multi-stage: builder is NOT shipped; only the slim production stage
#     (no devDependencies, no source maps needed in dist for production).
#   - Non-root user: nodejs:1001 (matches docker-compose user directive).
#   - HEALTHCHECK uses node http (already installed) — no wget needed.
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Pin npm to a version with current security patches.
RUN npm install -g npm@11.14.1 --no-audit --no-fund

# Production-only dependencies.
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund

# Copy built frontend + server entrypoints from the builder stage.
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/db.ts ./
COPY --from=builder /app/routes.ts ./
COPY --from=builder /app/services.ts ./
COPY --from=builder /app/tsconfig.json ./

# Server-side module tree required by routes.ts / services.ts / db.ts / server.ts
COPY --from=builder /app/src/db ./src/db
COPY --from=builder /app/src/lib ./src/lib
COPY --from=builder /app/src/middleware ./src/middleware
COPY --from=builder /app/src/routes ./src/routes
COPY --from=builder /app/src/services ./src/services
COPY --from=builder /app/src/types ./src/types

# Create data + backup directories with proper ownership BEFORE switching
# to the non-root user (root is needed for chown).
RUN mkdir -p /app/data /app/backups && \
    chown -R nodejs:nodejs /app

# Switch to non-root user for the runtime.
USER nodejs

# Persistent database volume.
VOLUME ["/app/data"]

EXPOSE 3000

ENV NODE_ENV=production
ENV DB_FILE=/app/data/database.sqlite

# Health check uses Node's built-in http (already installed, no extra
# packages needed). Polls /api/health every 30s.
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["npx", "tsx", "server.ts", "--network"]
