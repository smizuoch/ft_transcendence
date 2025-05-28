FROM node:22-bookworm AS builder

WORKDIR /app

# パッケージマネージャとしてpnpmを使用
RUN npm install -g pnpm@10.11.0

# OpenSSLをインストール（Prismaの依存関係）
RUN apt-get update && apt-get install -y openssl

# パッケージ依存関係をコピーしてインストール
COPY package.json ./
RUN pnpm install --no-frozen-lockfile

# ソースコードをコピー
COPY . .

# Prismaクライアントを生成してからビルド
RUN npx prisma generate
RUN pnpm run build

# 本番用イメージ
FROM node:22-bookworm-slim

WORKDIR /app

# SQLiteとOpenSSLに必要なパッケージをインストール
RUN apt-get update && apt-get install -y --no-install-recommends \
    sqlite3 \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# pnpmをインストール
RUN npm install -g pnpm@10.11.0

# ビルド済みアプリケーションをコピー
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma

# データベースディレクトリを作成
RUN mkdir -p /app/data

# 本番用依存関係のみインストール
RUN pnpm install --prod --no-frozen-lockfile

# ポート
EXPOSE 3000

# ボリューム設定 - SQLiteデータベースファイル用
VOLUME ["/app/data"]

# 環境変数設定
ENV DATABASE_URL="file:/app/data/auth.db"
ENV NODE_ENV="production"
# Fastifyサーバーがすべてのインターフェースでリッスンするための設定
ENV HOST="0.0.0.0" 
ENV PORT=3000

# マイグレーション実行と起動
CMD npx prisma migrate deploy && node dist/main.js
