# syntax=docker/dockerfile:1

# Dùng Debian slim thay vì Alpine để tránh lỗi build native module (bcrypt...).
ARG NODE_VERSION=22-bookworm-slim

########################################################################
# Stage: dependencies — cài đầy đủ dependency (kể cả dev) để phục vụ build
########################################################################
FROM node:${NODE_VERSION} AS dependencies
WORKDIR /app

# Prisma CLI (generate/migrate) cần libssl để chọn đúng engine binary.
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# npm bundled trong base image (10.x) xử lý optional dependency theo platform
# khác với npm dùng để tạo package-lock.json (11.x), gây lỗi EBADPLATFORM giả
# trên fsevents (chỉ dành cho macOS). Nâng npm lên cùng dòng major cho khớp.
RUN npm install -g npm@11

COPY package.json package-lock.json ./
RUN npm ci

########################################################################
# Stage: build — generate Prisma Client và build NestJS
########################################################################
FROM dependencies AS build
WORKDIR /app

# DATABASE_URL giả chỉ để thỏa mãn prisma.config.ts lúc `prisma generate`,
# KHÔNG phải secret thật và không được dùng để kết nối DB ở bước này.
ARG DATABASE_URL="postgresql://user:password@localhost:5432/db?schema=public"
ENV DATABASE_URL=${DATABASE_URL}

COPY . .
RUN npx prisma generate --schema database/schema.prisma
RUN npm run build

# Cắt dev dependency, chỉ giữ production dependency + Prisma Client đã generate.
RUN npm prune --omit=dev

########################################################################
# Stage: migration — chạy `prisma migrate deploy`, giữ Prisma CLI.
# Chạy một lần trước khi API nhận traffic, KHÔNG chạy trong entrypoint
# của mọi API replica.
########################################################################
FROM node:${NODE_VERSION} AS migration
WORKDIR /app
ENV NODE_ENV=production

# prisma migrate deploy cần libssl để chọn đúng schema-engine binary.
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY package.json package-lock.json prisma.config.ts ./
COPY database ./database

USER node
CMD ["npx", "prisma", "migrate", "deploy"]

########################################################################
# Stage: production — runtime tối giản, không chứa source/test/dev dependency
########################################################################
FROM node:${NODE_VERSION} AS production
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

# Chạy bằng user không phải root.
USER node

EXPOSE 8080

CMD ["node", "dist/src/main.js"]
