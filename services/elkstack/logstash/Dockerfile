FROM logstash:9.0.1

# パイプライン設定ファイルをコピー
COPY --chown=logstash:logstash pipeline.conf /usr/share/logstash/pipeline/logstash.conf

# Logstashの設定ファイル (logstash.yml) をコピーする場合は以下も追加
# COPY logstash.yml /usr/share/logstash/config/logstash.yml
