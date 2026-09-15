FROM node:24-alpine
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NODE_ENV=production
RUN corepack enable && addgroup -S panda && adduser -S panda -G panda
WORKDIR /app
COPY --chown=panda:panda package.json pnpm-workspace.yaml ./
COPY --chown=panda:panda packages/database ./packages/database
COPY --chown=panda:panda packages/domain ./packages/domain
RUN pnpm install --no-frozen-lockfile
USER panda
CMD ["sh", "-c", "echo 'Panda worker foundation ready'; sleep infinity"]
