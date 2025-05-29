FROM node:22-bookworm AS builder

WORKDIR /app

# パッケージマネージャとしてpnpmを使用
RUN npm install -g pnpm@10.11.0

# ts-nodeをグローバルにインストール
RUN npm install -g ts-node typescript

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

# ts-nodeとtypescriptをグローバルにインストール
RUN npm install -g ts-node typescript

# ビルド済みアプリケーションをコピー
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/tsconfig.json ./

# データベースディレクトリを作成
RUN mkdir -p /app/data

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

# マイグレーション実行、シード処理、そして起動
CMD npx prisma migrate dev --name init --create-only && \
    npx prisma migrate deploy && \
    npx prisma db seed && \
    node dist/main.js
