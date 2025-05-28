FROM logstash:9.0.1

# パイプライン設定ファイルをコピー
COPY --chown=logstash:logstash ./pipeline.conf /usr/share/logstash/pipeline/logstash.conf

# Logstashの設定ファイル (logstash.yml) をコピーする場合は以下も追加
COPY --chown=logstash:logstash ./logstash.yml /usr/share/logstash/config/logstash.yml

# 証明書ディレクトリを作成（ボリュームマウント用）
RUN mkdir -p /usr/share/logstash/config/certs && \
    chown -R logstash:logstash /usr/share/logstash/config/certs
