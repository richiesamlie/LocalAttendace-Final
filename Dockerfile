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

WORKDIR /app

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy built files from builder
COPY --from=builder /app/dist ./
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/db.ts ./
COPY --from=builder /app/routes.ts ./
COPY --from=builder /app/tsconfig.json ./

# Create volume for persistent database
VOLUME ["/app/data"]

EXPOSE 3000

ENV NODE_ENV=production

CMD ["npx", "tsx", "server.ts"]
