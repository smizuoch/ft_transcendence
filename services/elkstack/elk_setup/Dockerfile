FROM docker.elastic.co/elasticsearch/elasticsearch:9.0.1

COPY --chmod=755 ./entrypoint.sh /usr/local/bin/entrypoint.sh

USER root

CMD ["/usr/local/bin/entrypoint.sh"]
