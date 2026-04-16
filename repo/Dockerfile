FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

# ── Test runner (used by docker compose --profile test) ──────────────────
FROM builder AS test-runner
RUN apk add --no-cache openssl
RUN npx prisma generate
COPY jest.config.ts ./
COPY tests ./tests
CMD ["npx", "jest", "--forceExit", "--detectOpenHandles", "--verbose"]

# ── Production runtime ───────────────────────────────────────────────────
FROM node:20-alpine

RUN apk add --no-cache mysql-client openssl

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm install tsx

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/dist ./dist
COPY prisma ./prisma
COPY scripts ./scripts

RUN chmod +x scripts/*.sh

EXPOSE 3000

CMD ["/bin/sh", "scripts/entrypoint.sh"]
