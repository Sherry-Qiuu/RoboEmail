# One image, two stages: Vite builds the frontend, Node runs the API and
# serves the result. Debian slim rather than Alpine because @node-rs/argon2 is
# a native module and its glibc build is the reliable one.

FROM node:24-slim AS build
WORKDIR /app

RUN corepack enable

# Dependency manifests first, so a source edit does not bust the install layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps ./apps
COPY --from=build /app/package.json ./package.json

# The SQLite file lives here; mount it so the database survives a rebuild.
VOLUME ["/app/apps/server/data"]

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/server/src/index.ts"]
