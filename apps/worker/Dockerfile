FROM node:24-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable \
  && apt-get update \
  && apt-get upgrade -y --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/worker/package.json apps/worker/
RUN pnpm install --frozen-lockfile --filter @hht/worker...

FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN corepack enable \
  && apt-get update \
  && apt-get upgrade -y --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/worker apps/worker
RUN pnpm --filter @hht/shared build && pnpm --filter @hht/worker build

FROM node:24-bookworm-slim AS prod-deps
WORKDIR /app
ENV HUSKY=0
RUN corepack enable \
  && apt-get update \
  && apt-get upgrade -y --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/worker/package.json apps/worker/
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/worker/dist apps/worker/dist
RUN pnpm install --frozen-lockfile --filter @hht/worker... --prod --ignore-scripts

FROM gcr.io/distroless/nodejs24-debian13 AS runner
WORKDIR /app/apps/worker
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=prod-deps /app/packages/shared /app/packages/shared
COPY --from=prod-deps /app/apps/worker /app/apps/worker
CMD ["dist/index.js"]
