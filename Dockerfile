FROM node:22-alpine AS base

# --- Dependencies ---
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* pnpm-lock.yaml* ./
RUN if [ -f pnpm-lock.yaml ]; then \
      corepack enable && pnpm install --frozen-lockfile; \
    else \
      npm ci; \
    fi

# --- Build ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV BUILD_STANDALONE=true
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- Production ---
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create app user — UID/GID set at build time to match the host opendkim user
ARG APP_UID=113
ARG APP_GID=113
RUN addgroup -g ${APP_GID} -S dkim && \
    adduser -u ${APP_UID} -S -G dkim dkim

COPY --from=builder /app/public ./public
COPY --from=builder --chown=dkim:dkim /app/.next/standalone ./
COPY --from=builder --chown=dkim:dkim /app/.next/static ./.next/static

USER dkim

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
