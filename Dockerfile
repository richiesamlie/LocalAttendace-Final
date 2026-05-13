FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./
RUN npm ci --ignore-scripts

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Production stage
FROM node:20-alpine

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Upgrade npm to include latest security fixes in bundled npm dependencies
RUN npm install -g npm@11.14.1

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy built frontend from builder
COPY --from=builder /app/dist ./dist

# Copy server-side TypeScript source files (run via tsx in production)
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/db.ts ./
COPY --from=builder /app/routes.ts ./
COPY --from=builder /app/services.ts ./
COPY --from=builder /app/tsconfig.json ./

# Copy server-side lib modules required by routes.ts and server.ts
COPY --from=builder /app/src/lib/validation.ts ./src/lib/
COPY --from=builder /app/src/lib/errorHandler.ts ./src/lib/

# Create directories with proper permissions
RUN mkdir -p /app/data /app/backups && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Create volume for persistent database
VOLUME ["/app/data"]

EXPOSE 3000

ENV NODE_ENV=production
ENV DB_FILE=/app/data/database.sqlite

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["npx", "tsx", "server.ts"]
