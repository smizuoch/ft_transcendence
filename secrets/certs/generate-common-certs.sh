#!/bin/bash

set -e

CERTS_DIR="${PWD}"
mkdir -p "$CERTS_DIR"

echo "Generating CA and server SSL certificates for all services..."

# Generate CA private key
openssl genrsa -out "$CERTS_DIR/ca.key" 2048

# Generate CA certificate
openssl req -new -x509 -key "$CERTS_DIR/ca.key" -out "$CERTS_DIR/ca.crt" -days 3650 \
    -subj "/C=JP/ST=Tokyo/L=Tokyo/O=42Tokyo/OU=ft_transcendence CA/CN=42Tokyo Root CA" \
    -addext "basicConstraints=CA:TRUE" \
    -addext "keyUsage=digitalSignature,keyCertSign"

# Generate server private key
openssl genrsa -out "$CERTS_DIR/server.key" 2048

# Create server certificate configuration
# Create server certificate configuration
cat > "$CERTS_DIR/server.conf" << EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
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
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth, clientAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = nginx
DNS.3 = sfu
DNS.4 = elasticsearch
DNS.5 = kibana
DNS.6 = logstash
DNS.7 = auth
DNS.8 = npc_manager
IP.1 = 127.0.0.1
IP.2 = ::1
IP.3 = "YOUR_SERVER_IP"  # Replace with your server's IP address
EOF

# Generate server certificate signing request
openssl req -new -key "$CERTS_DIR/server.key" -out "$CERTS_DIR/server.csr" -config "$CERTS_DIR/server.conf"

# Generate server certificate signed by CA
openssl x509 -req -in "$CERTS_DIR/server.csr" -CA "$CERTS_DIR/ca.crt" -CAkey "$CERTS_DIR/ca.key" \
    -CAcreateserial -out "$CERTS_DIR/server.crt" -days 365 \
    -extensions v3_req -extfile "$CERTS_DIR/server.conf"

# Set appropriate permissions
chmod 644 "$CERTS_DIR"/server.crt "$CERTS_DIR"/ca.crt "$CERTS_DIR"/*.crt
chmod 600 "$CERTS_DIR"/server.key "$CERTS_DIR"/ca.key "$CERTS_DIR"/*.key

# Clean up CSR file
rm -f "$CERTS_DIR/server.csr"

echo "CA and server SSL certificates generated successfully in $CERTS_DIR"
echo "CA Certificate details:"
openssl x509 -in "$CERTS_DIR/ca.crt" -text -noout | grep -E "Issuer|Subject|CA:"
echo ""
echo "Server Certificate details:"
openssl x509 -in "$CERTS_DIR/server.crt" -text -noout | grep -A 10 "Subject Alternative Name"
echo ""
echo "Certificate chain verification:"
openssl verify -CAfile "$CERTS_DIR/ca.crt" "$CERTS_DIR/server.crt"