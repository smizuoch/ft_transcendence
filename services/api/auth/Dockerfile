FROM node:22-bookworm

WORKDIR /app

# 必要なパッケージのみインストール
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# パッケージマネージャとしてpnpmを使用
RUN npm install -g pnpm@10.11.0

# 開発に必要なツールをインストール
RUN npm install -g ts-node typescript

# パッケージ依存関係をコピーしてインストール
COPY package.json ./
RUN pnpm install --no-frozen-lockfile

# ソースコードをコピー
COPY . .

# データベースディレクトリを作成
RUN mkdir -p /app/data

# Prismaクライアントを生成してビルド
RUN npx prisma generate && pnpm run build

# マイグレーション実行、シード処理、そして起動
CMD ["sh", "-c", "npx prisma migrate dev --name init && npx prisma migrate deploy && npx prisma db seed && node dist/main.js"]
