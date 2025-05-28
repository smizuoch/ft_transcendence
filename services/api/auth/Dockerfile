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

# pnpmをインストール
RUN npm install -g pnpm@10.11.0

# ビルド済みアプリケーションをコピー
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma

# 本番用依存関係のみインストール
RUN pnpm install --prod --frozen-lockfile

# Prismaクライアントを生成
RUN npx prisma generate

# ポート
EXPOSE 3000

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => process.exit(r.ok ? 0 : 1))" || exit 1

# アプリケーション起動
CMD ["node", "dist/main.js"]
