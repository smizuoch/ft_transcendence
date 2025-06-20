#!/bin/bash

# 環境変数のチェック
if [ -z "${ELASTIC_PASSWORD}" ]; then
  echo "Set the ELASTIC_PASSWORD environment variable"
  exit 1
elif [ -z "${KIBANA_PASSWORD}" ]; then
  echo "Set the KIBANA_PASSWORD environment variable"
  exit 1
fi

# CA証明書の作成
if [ ! -f config/certs/ca.zip ]; then
  echo "Creating CA"
  bin/elasticsearch-certutil ca --silent --pem -out config/certs/ca.zip
  unzip config/certs/ca.zip -d config/certs
fi

# サーバー証明書の作成
if [ ! -f config/certs/certs.zip ]; then
  echo "Creating certs"
  cat > config/certs/instances.yml << EOF
instances:
  - name: elasticsearch
    dns:
      - elasticsearch
      - localhost
    ip:
      - 127.0.0.1
  - name: logstash
    dns:
      - logstash
      - localhost
    ip:
      - 127.0.0.1
  - name: kibana
    dns:
      - kibana
      - localhost
    ip:
      - 127.0.0.1
EOF
  bin/elasticsearch-certutil cert --silent --pem -out config/certs/certs.zip --in config/certs/instances.yml --ca-cert config/certs/ca/ca.crt --ca-key config/certs/ca/ca.key
  unzip config/certs/certs.zip -d config/certs
fi

# ファイル権限の設定（rootless対応）
echo "Setting file permissions"
chown -R 1000:1000 config/certs
find config/certs -type d -exec chmod 755 {} \;
find config/certs -type f -exec chmod 644 {} \;

# Elasticsearchの起動を待つ
echo "Waiting for Elasticsearch availability"
until curl -s --cacert config/certs/ca/ca.crt https://elasticsearch:9200 | grep -q "missing authentication credentials"; do
  echo "Waiting for Elasticsearch..."
  sleep 1
done

# kibana_systemユーザーのパスワード設定
echo "Setting kibana_system password"
until curl -s -X POST --cacert config/certs/ca/ca.crt -u "${ELASTICSEARCH_USERNAME}:${ELASTIC_PASSWORD}" -H "Content-Type: application/json" https://elasticsearch:9200/_security/user/kibana_system/_password -d "{\"password\":\"${KIBANA_PASSWORD}\"}" | grep -q "^{}"; do
  echo "Retrying kibana_system password setup..."
  sleep 1
done

echo "Setup completed successfully!"
