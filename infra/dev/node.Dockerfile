# Local dev image for the Vue dashboard (Vite), the Expo client (web) and EAS CLI. Build context = repo root.
# Dependencies are installed inside Linux; `docker compose watch` syncs source edits into /repo.
FROM node:26.13.0-slim@sha256:e4db4c914bf8ad241bd24804fc25d272d89bad97e68cdc8a1414862790a02c39
RUN npm install -g pnpm@12.16.1 && install -d -o node -g node /repo
USER node
WORKDIR /repo
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chown=node:node apps/web-dashboard/package.json apps/web-dashboard/
COPY --chown=node:node apps/mobile-client/package.json apps/mobile-client/
COPY --chown=node:node packages/api-client/package.json packages/api-client/
COPY --chown=node:node packages/design-tokens/package.json packages/design-tokens/
RUN pnpm install --frozen-lockfile
# EAS uploads /repo as the project root and applies these ignore rules (see the `eas` service).
COPY --chown=node:node .gitignore ./
COPY --chown=node:node packages ./packages
COPY --chown=node:node apps/web-dashboard ./apps/web-dashboard
COPY --chown=node:node apps/mobile-client ./apps/mobile-client
