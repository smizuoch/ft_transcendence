FROM node:22-bookworm AS builder

WORKDIR /app

# パッケージマネージャとしてpnpmを使用
RUN npm install -g pnpm@10.11.0

# パッケージ依存関係をコピーしてインストール
COPY package.json ./
RUN pnpm install --frozen-lockfile

# ソースコードをコピー
COPY . .

# TypeScriptをコンパイル
RUN pnpm run build

# 本番用イメージ
FROM node:22-bookworm-slim

WORKDIR /app

# SQLiteに必要なパッケージをインストール
RUN apt-get update && apt-get install -y --no-install-recommends \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# pnpmをインストール
RUN npm install -g pnpm@10.11.0

# ビルド済みアプリケーションをコピー
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma

# データベースディレクトリを作成
RUN mkdir -p /app/data

# 本番用依存関係のみインストール
RUN pnpm install --prod --frozen-lockfile

# Prismaクライアントを生成
RUN npx prisma generate

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

# アプリケーション起動
CMD ["node", "dist/main.js"]
