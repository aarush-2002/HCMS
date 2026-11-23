# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY web/package.json ./web/

RUN npm ci

COPY tsconfig.base.json ./
COPY shared ./shared
COPY web ./web

RUN npm run build --workspace=shared
RUN npm run build --workspace=web

# Stage 2: Nginx Web Server
FROM nginx:alpine AS runner

COPY --from=builder /app/web/dist /usr/share/nginx/html
COPY web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
