FROM node:22-bookworm AS base

WORKDIR /app

# 必要なパッケージのみインストール
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# パッケージマネージャとしてpnpmを使用
RUN npm install -g pnpm@10.11.0

# 開発に必要なツールをインストール
RUN npm install -g ts-node typescript @nestjs/cli

# パッケージ依存関係をコピーしてインストール
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --no-frozen-lockfile

# Build stage
FROM base AS build-stage

# ソースコードをコピー（node_modulesは除外）
COPY srcs ./srcs
COPY prisma ./prisma
COPY nest-cli.json tsconfig.json ./

# データベースディレクトリを作成
RUN mkdir -p /app/data

# Prismaクライアントを生成
RUN npx prisma generate

# TypeScriptファイルの構文チェック
RUN npx tsc --noEmit

# ビルド実行
RUN pnpm run build

# Production stage
FROM base AS production

# ビルド済みファイルをコピー
COPY --from=build-stage /app/dist ./dist
COPY --from=build-stage /app/node_modules ./node_modules
COPY --from=build-stage /app/prisma ./prisma
COPY --from=build-stage /app/package.json ./

# データベースディレクトリを作成
RUN mkdir -p /app/data

# マイグレーション実行、シード処理、そして起動
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && (npx prisma db seed || echo 'Seed skipped') && node dist/main.js"]