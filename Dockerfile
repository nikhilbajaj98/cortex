FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:20-alpine

RUN apk add --no-cache curl

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
# Use the same tree as the build stage so SQL migrations cannot drift from the
# image (avoids empty/missing migrations when build context differs on the host).
COPY --from=builder /app/migrations ./migrations
RUN test -f migrations/001_create_events.sql && test -f migrations/clickhouse/001_init_analytics.sql

EXPOSE 8080
CMD ["node", "dist/index.js"]


