FROM node:22-bookworm

WORKDIR /app

# 依存関係をインストール（Debianベースなのでapt-getを使用）
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    make \
    g++ \
    pkg-config \
    libssl-dev \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 依存関係をインストール（ビルド用にdevDependenciesも含める）
RUN npm install --verbose

# TypeScript設定ファイルをコピー
COPY tsconfig.json ./

# ソースコードとスクリプトをコピー
COPY src/ ./src/
COPY scripts/ ./scripts/

# TypeScriptをビルド
RUN npm run build

# SSL証明書を生成
RUN chmod +x ./scripts/generate-ssl-certs.sh && ./scripts/generate-ssl-certs.sh

# 本番用ユーザーを作成
RUN addgroup --gid 1001 nodejs
RUN adduser --disabled-password --gecos "" --uid 1001 --gid 1001 sfu

# アプリケーションファイルの所有者を変更
RUN chown -R sfu:nodejs /app
USER sfu

# ポートを公開
EXPOSE 3001

# サーバーを起動
CMD ["npm", "start"]
