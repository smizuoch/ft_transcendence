#!/bin/bash

# SSL証明書生成スクリプト
CERT_DIR="/app/certs"
mkdir -p $CERT_DIR

# 自己署名証明書を生成
openssl req -x509 -newkey rsa:4096 -keyout $CERT_DIR/server.key -out $CERT_DIR/server.crt -days 365 -nodes -subj "/C=JP/ST=Tokyo/L=Tokyo/O=42Tokyo/OU=ft_transcendence/CN=localhost"

# IP SANsを含む証明書を生成（ローカルネットワーク用）
cat > $CERT_DIR/san.conf << EOF
[req]
default_bits = 4096
prompt = no
distinguished_name = dn
req_extensions = v3_req

[dn]
C=JP
ST=Tokyo
L=Tokyo
O=42Tokyo
OU=ft_transcendence
CN=localhost

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
IP.1 = 127.0.0.1
IP.2 = 0.0.0.0
IP.3 = 10.16.2.9
IP.4 = 192.168.1.100
EOF

# IP SANs付きの証明書を生成
openssl req -x509 -newkey rsa:4096 -keyout $CERT_DIR/server-san.key -out $CERT_DIR/server-san.crt -days 365 -nodes -config $CERT_DIR/san.conf -extensions v3_req

echo "SSL certificates generated in $CERT_DIR"
ls -la $CERT_DIR