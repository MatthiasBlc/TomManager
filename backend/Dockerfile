# ========================================
# Stage 1: Builder
# ========================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY ./backend/package*.json ./

# Install all dependencies (including dev)
RUN npm ci

# Copy Prisma schema and generate client
COPY ./backend/prisma ./prisma/
RUN npx prisma generate

# Copy source code
COPY ./backend/tsconfig.json ./
COPY ./backend/src ./src/

# Build TypeScript
RUN npm run build

# Prune dev dependencies
RUN npm prune --omit=dev

# ========================================
# Stage 2: Runtime
# ========================================
FROM node:22-alpine AS runtime

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache openssl wget

# Copy from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules/
COPY --from=builder /app/dist ./dist/
COPY --from=builder /app/prisma ./prisma/

# Create logs directory
RUN mkdir -p /app/logs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget --spider -q http://localhost:3001/health || exit 1

# Start command
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
