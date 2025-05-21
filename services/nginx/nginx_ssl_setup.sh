#!/bin/bash

CERT_DIR="/etc/nginx/certs"
KEY_FILE="${CERT_DIR}/nginx.key"
CERT_FILE="${CERT_DIR}/nginx.crt"
DAYS_VALID=365
COUNTRY="JP"
STATE="Tokyo"
LOCALITY="Tokyo"
ORG_NAME="42Tokyo"
ORG_UNIT="student"
COMMON_NAME="localhost" # または実際のドメイン名
EMAIL="student@student.42tokyo.jp"

# Check if certificate and key already exist
if [ -f "${KEY_FILE}" ] && [ -f "${CERT_FILE}" ]; then
  echo "SSL certificate and key already exist. Skipping generation."
else
  echo "Generating SSL certificate and key..."
  # Create the directory if it doesn't exist
  mkdir -p "${CERT_DIR}"

  # Generate self-signed certificate
  openssl req -x509 -nodes -days "${DAYS_VALID}" -newkey rsa:2048 \
    -keyout "${KEY_FILE}" \
    -out "${CERT_FILE}" \
    -subj "/C=${COUNTRY}/ST=${STATE}/L=${LOCALITY}/O=${ORG_NAME}/OU=${ORG_UNIT}/CN=${COMMON_NAME}/emailAddress=${EMAIL}"

  if [ $? -eq 0 ]; then
    echo "SSL certificate and key generated successfully."
  else
    echo "Error generating SSL certificate and key."
    exit 1
  fi
fi

# Start nginx in the foreground
echo "Starting Nginx..."
nginx -g 'daemon off;'
