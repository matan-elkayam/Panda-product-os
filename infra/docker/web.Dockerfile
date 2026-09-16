FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY packages/domain/package.json packages/domain/package.json
RUN pnpm install --no-frozen-lockfile

FROM deps AS build
ENV NODE_ENV=production
ENV AUTH_SECRET=build-only-placeholder-not-for-runtime
COPY . .
RUN pnpm --filter @panda/web build

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /app
RUN addgroup -S panda && adduser -S panda -G panda
COPY --from=build --chown=panda:panda /app/apps/web/.next/standalone ./
COPY --from=build --chown=panda:panda /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=panda:panda /app/apps/web/public ./apps/web/public
USER panda
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
