FROM node:22-bookworm

WORKDIR /app

# pnpmをインストール
RUN npm install -g pnpm@10.11.0

# package.jsonをコピーして依存関係をインストール
COPY package.json ./
RUN pnpm install

# ソースコードをコピー
COPY . .

# TypeScriptをビルド
RUN pnpm run build

# ログディレクトリを作成
RUN mkdir -p /host/logs && chmod 755 /host/logs

# 非rootユーザーを作成
RUN groupadd -r appuser && useradd -r -g appuser appuser
RUN chown -R appuser:appuser /app /host/logs
USER appuser

EXPOSE 3005

CMD ["pnpm", "start"]
