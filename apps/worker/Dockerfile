ARG PNPM_VERSION=10.33.0

FROM node:24-alpine AS deps
ARG PNPM_VERSION
WORKDIR /app
RUN npm install -g pnpm@${PNPM_VERSION} \
  && apk update \
  && apk upgrade --no-cache
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/worker/package.json apps/worker/
RUN pnpm install --frozen-lockfile --filter @hht/worker...

FROM node:24-alpine AS build
ARG PNPM_VERSION
WORKDIR /app
RUN npm install -g pnpm@${PNPM_VERSION} \
  && apk update \
  && apk upgrade --no-cache
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/worker apps/worker
RUN pnpm --filter @hht/shared build && pnpm --filter @hht/worker build

FROM node:24-alpine AS prod-deps
ARG PNPM_VERSION
WORKDIR /app
ENV HUSKY=0
RUN npm install -g pnpm@${PNPM_VERSION} \
  && apk update \
  && apk upgrade --no-cache
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/worker/package.json apps/worker/
RUN pnpm install --frozen-lockfile --filter @hht/worker... --prod --ignore-scripts
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/worker/dist apps/worker/dist

FROM gcr.io/distroless/nodejs24-debian13 AS runner
WORKDIR /app/apps/worker
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=prod-deps /app/packages/shared /app/packages/shared
COPY --from=prod-deps /app/apps/worker /app/apps/worker
CMD ["dist/index.js"]
