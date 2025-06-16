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
COPY services/sfu42/package*.json ./

# 依存関係をインストール（ビルド用にdevDependenciesも含める）
RUN npm install --verbose

# TypeScript設定ファイルをコピー
COPY services/sfu42/tsconfig.json ./

# ソースコードとスクリプトをコピー
COPY services/sfu42/src/ ./src/

# SSL証明書ディレクトリを作成（権限も設定）
RUN mkdir -p /app/certs /app/internal-certs && chmod 755 /app/certs /app/internal-certs

# SSL証明書をコピー（ビルド時に利用可能な場合）
COPY secrets/certs /app/certs/

# TypeScriptをビルド
RUN npm run build

# 本番用ユーザーを作成
RUN addgroup --gid 1001 nodejs
RUN adduser --disabled-password --gecos "" --uid 1001 --gid 1001 sfu

# アプリケーションファイルの所有者を変更（証明書ディレクトリも含む）
RUN chown -R sfu:nodejs /app
USER sfu

# ポートを公開
EXPOSE 3042

# サーバーを起動
CMD ["npm", "start"]
