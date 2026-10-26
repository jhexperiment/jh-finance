FROM node:24-alpine AS deps
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc* ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
ARG API_APP_NAME=client
WORKDIR /repo/apps/api
RUN pnpm prisma:generate && pnpm nest build ${API_APP_NAME}

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ARG API_APP_NAME=client
COPY --from=build /repo/apps/api/dist/apps/${API_APP_NAME} ./dist
COPY --from=build /repo/node_modules ./node_modules
CMD ["node", "dist/main.js"]
