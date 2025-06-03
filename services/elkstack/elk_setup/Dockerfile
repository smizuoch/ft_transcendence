FROM docker.elastic.co/elasticsearch/elasticsearch:9.0.1

COPY --chmod=755 ./entrypoint.sh /usr/local/bin/entrypoint.sh

# 一時的にrootで実行（証明書生成のため）
USER root

CMD ["/usr/local/bin/entrypoint.sh"]
