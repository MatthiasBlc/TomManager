# ========================================
# Stage 1: Builder
# ========================================
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma/
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src/
RUN npm run build
RUN npm prune --omit=dev

# ========================================
# Stage 2: Runtime
# ========================================
FROM node:22-alpine AS runtime

WORKDIR /app

RUN apk add --no-cache openssl

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules/
COPY --from=builder /app/dist ./dist/
COPY --from=builder /app/prisma ./prisma/

CMD ["node", "dist/index.js"]
