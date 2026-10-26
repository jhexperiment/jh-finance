FROM node:24-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/client-api-sdk/package.json packages/client-api-sdk/package.json
RUN pnpm install --frozen-lockfile
COPY . .
WORKDIR /repo/apps/web
RUN pnpm build

FROM nginx:1.27-alpine
COPY apps/web/nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
