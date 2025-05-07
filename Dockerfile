FROM node:22.14.0-alpine AS base
# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare yarn@4.5.0 --activate
WORKDIR /app
# Install dependencies based on the preferred package manager
COPY . .
RUN \
    if [ -f yarn.lock ]; then yarn && npm run postinstall; \
    elif [ -f package-lock.json ]; then npm ci; \
    elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \
    else echo "Lockfile not found." && exit 1; \
    fi
# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
ARG NEXT_PRIVATE_STANDALONE=true
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN \
    if [ -f yarn.lock ]; then yarn build; \
    elif [ -f package-lock.json ]; then npm run build; \
    elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm run build; \
    else echo "Lockfile not found." && exit 1; \
    fi
# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app
COPY --from=builder /app/public ./public
RUN mkdir .next
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
ENV PORT 3000
CMD HOSTNAME="0.0.0.0" node server.js