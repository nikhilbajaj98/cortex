FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN if [ -f package-lock.json ]; then npm ci; \
    elif [ -f yarn.lock ]; then yarn --frozen-lockfile; \
    elif [ -f pnpm-lock.yaml ]; then npm i -g pnpm && pnpm i --frozen-lockfile; \
    else npm i; fi

FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_KONG_URL=http://localhost:8000
ARG NEXT_PUBLIC_KONG_API_KEY=test-key
ENV NEXT_PUBLIC_KONG_URL=$NEXT_PUBLIC_KONG_URL
ENV NEXT_PUBLIC_KONG_API_KEY=$NEXT_PUBLIC_KONG_API_KEY
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Ensure public directory exists (create .gitkeep if directory is empty)
RUN mkdir -p ./public && touch ./public/.gitkeep
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
# Copy public directory (now guaranteed to exist with .gitkeep from builder stage)
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["npm", "start"]
