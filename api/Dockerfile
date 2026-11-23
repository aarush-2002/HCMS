# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace package files
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY api/package.json ./api/

# Install all dependencies for build
RUN npm ci

# Copy source code
COPY tsconfig.base.json ./
COPY shared ./shared
COPY api ./api

# Build shared package
RUN npm run build --workspace=shared

# Generate Prisma client and compile TypeScript for api
WORKDIR /app/api
RUN npx prisma generate
RUN npm run build

# Stage 2: Production Runner
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install openssl for Prisma
RUN apk add --no-cache openssl

# Copy root files and package manifests
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY api/package.json ./api/

# Install production dependencies only
RUN npm ci --omit=dev

# Copy compiled shared package
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/shared/package.json ./shared/package.json

# Copy compiled api code, prisma schema & migrations
COPY --from=builder /app/api/dist ./api/dist
COPY --from=builder /app/api/prisma ./api/prisma
COPY --from=builder /app/api/node_modules/.prisma ./api/node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Create uploads directory and ensure permissions
RUN mkdir -p /app/uploads && chown -R node:node /app

USER node
WORKDIR /app/api

EXPOSE 5000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
