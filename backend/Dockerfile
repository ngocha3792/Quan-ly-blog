# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:22-bookworm-slim

FROM ${NODE_IMAGE} AS base

WORKDIR /app

ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates dumb-init openssl \
    && rm -rf /var/lib/apt/lists/*


FROM base AS dependencies

COPY package.json package-lock.json ./
COPY database/schema.prisma ./database/schema.prisma
COPY prisma.config.ts ./

# Prisma config cần một URL hợp lệ khi generate; bước build không kết nối URL này.
RUN DATABASE_URL="postgresql://docker-build:docker-build@localhost:5432/docker-build" npm ci


FROM dependencies AS build

COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY database ./database
COPY libs ./libs
COPY src ./src

RUN DATABASE_URL="postgresql://docker-build:docker-build@localhost:5432/docker-build" npx prisma generate \
    && npm run build


# Target chỉ dùng cho release job chạy migration, không dùng để phục vụ HTTP.
FROM build AS migration

ENV NODE_ENV=production

USER node

ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "db:deploy"]


FROM base AS production-dependencies

COPY package.json package-lock.json ./
COPY database/schema.prisma ./database/schema.prisma
COPY prisma.config.ts ./

RUN DATABASE_URL="postgresql://docker-build:docker-build@localhost:5432/docker-build" npm ci --omit=dev \
    && rm -rf node_modules/prisma node_modules/.bin/prisma \
    && npm cache clean --force


FROM base AS production

ENV NODE_ENV=production \
    APP_PORT=8080 \
    API_PREFIX=api/v1

COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=node:node /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./package.json

USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "const port=process.env.APP_PORT||process.env.PORT||8080;const prefix=(process.env.API_PREFIX||'api/v1').replace(/^\/+|\/+$/g,'');fetch('http://127.0.0.1:'+port+'/'+prefix+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/main.js"]
