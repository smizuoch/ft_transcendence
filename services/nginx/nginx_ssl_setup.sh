#!/bin/bash

COMMON_CERT_DIR="/app/certs"
CERT_DIR="/etc/nginx/certs"
KEY_FILE="${CERT_DIR}/nginx.key"
CERT_FILE="${CERT_DIR}/nginx.crt"

# Create nginx cert directory
mkdir -p "${CERT_DIR}"

# 既にnginx用の証明書が存在するかチェック
if [ -f "${CERT_FILE}" ] && [ -f "${KEY_FILE}" ]; then
    echo "SSL certificates already exist for nginx in ${CERT_DIR}"
    ls -la "${CERT_DIR}"
    echo "Starting Nginx..."
    nginx -g 'daemon off;'
    exit 0
fi

# Check if common certificates exist
if [ -f "${COMMON_CERT_DIR}/server.crt" ] && [ -f "${COMMON_CERT_DIR}/server.key" ]; then
  echo "Using common SSL certificates..."
  # Copy common certificates to nginx location
  cp "${COMMON_CERT_DIR}/server.crt" "${CERT_FILE}"
  cp "${COMMON_CERT_DIR}/server.key" "${KEY_FILE}"
  echo "Common SSL certificates copied successfully."
elif [ -f "${COMMON_CERT_DIR}/nginx.crt" ] && [ -f "${COMMON_CERT_DIR}/nginx.key" ]; then
  echo "Using common SSL certificates (symlink)..."
  # Use symlinked certificates
  cp "${COMMON_CERT_DIR}/nginx.crt" "${CERT_FILE}"
  cp "${COMMON_CERT_DIR}/nginx.key" "${KEY_FILE}"
  echo "Common SSL certificates copied successfully."
else
  echo "Common certificates not found. Generating certificates using common script..."
  # Run common certificate generation script if available
  if [ -f "${COMMON_CERT_DIR}/generate-common-certs.sh" ]; then
    cd "${COMMON_CERT_DIR}" && ./generate-common-certs.sh
    # Copy generated certificates
    cp "${COMMON_CERT_DIR}/server.crt" "${CERT_FILE}"
    cp "${COMMON_CERT_DIR}/server.key" "${KEY_FILE}"
    echo "Certificates generated and copied successfully."
  else
    echo "Common certificate generation script not found. Falling back to individual generation..."
    # Fallback to original certificate generation
    DAYS_VALID=365
    COUNTRY="JP"
    STATE="Tokyo"
    LOCALITY="Tokyo"
    ORG_NAME="42Tokyo"
    ORG_UNIT="student"
    COMMON_NAME="*"
    EMAIL="student@student.42tokyo.jp"

    openssl req -x509 -nodes -days "${DAYS_VALID}" -newkey rsa:2048 \
      -keyout "${KEY_FILE}" \
      -out "${CERT_FILE}" \
      -subj "/C=${COUNTRY}/ST=${STATE}/L=${LOCALITY}/O=${ORG_NAME}/OU=${ORG_UNIT}/CN=${COMMON_NAME}/emailAddress=${EMAIL}"
    
    if [ $? -eq 0 ]; then
      echo "Fallback SSL certificate generated successfully."
    else
      echo "Error generating SSL certificate."
      exit 1
    fi
  fi
fi

# Start nginx in the foreground
echo "Starting Nginx..."
nginx -g 'daemon off;'
