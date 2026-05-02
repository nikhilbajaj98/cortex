FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN if [ -f package-lock.json ]; then npm ci; \
    elif [ -f yarn.lock ]; then yarn --frozen-lockfile; \
    elif [ -f pnpm-lock.yaml ]; then npm i -g pnpm && pnpm i --frozen-lockfile; \
    else npm i; fi

FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_KONG_URL=http://localhost:8000
ARG NEXT_PUBLIC_KONG_API_KEY=test-key
ENV NEXT_PUBLIC_KONG_URL=$NEXT_PUBLIC_KONG_URL
ENV NEXT_PUBLIC_KONG_API_KEY=$NEXT_PUBLIC_KONG_API_KEY
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p ./public && touch ./public/.gitkeep
RUN npm run build
# Fail fast if standalone output is missing (required when next.config has output: 'standalone')
RUN test -f .next/standalone/server.js

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Standalone server listens here; nginx uses the container bridge IP, not 127.0.0.1
ENV HOSTNAME=0.0.0.0
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
