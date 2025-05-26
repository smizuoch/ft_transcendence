FROM docker.elastic.co/beats/filebeat:9.0.1

# 設定ファイルをコンテナにコピーし、filebeatユーザー・グループに所有者を設定
# --chown=filebeat:filebeatの理由: rootlessな実行を確保するため
COPY --chown=filebeat:filebeat ./filebeat.yml /usr/share/filebeat/filebeat.yml

# ベースイメージで既に USER filebeat が設定されているため、明示的な USER 指示は通常不要
# コンテナ起動時のデフォルトコマンドはベースイメージのものを利用
# 必要に応じて CMD ["filebeat", "-e", "-strict.perms=false"] などで上書き
