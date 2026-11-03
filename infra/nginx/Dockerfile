# Immutable origin image: Nginx + built dashboard. Build context = repo root.
FROM node:26.13.0-slim@sha256:e4db4c914bf8ad241bd24804fc25d272d89bad97e68cdc8a1414862790a02c39 AS build
WORKDIR /repo
RUN npm install -g pnpm@12.16.1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/web-dashboard ./apps/web-dashboard
COPY docs/contracts ./docs/contracts
RUN pnpm install --frozen-lockfile --filter @repo/web-dashboard... \
 && pnpm --filter @repo/web-dashboard... build

FROM nginx:1.30.6-alpine@sha256:0e52bd054126cdc040b1276c0af347aeb02a41b9cfe305d6094767ac30e97949
COPY infra/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY infra/nginx/snippets /etc/nginx/snippets
COPY --from=build /repo/apps/web-dashboard/dist /usr/share/nginx/html
