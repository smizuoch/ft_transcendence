FROM nginx:1.28-bookworm

# Install openssl for generating self-signed certificates for the script
RUN apt-get update && apt-get install -y openssl

# Copy nginx configuration
COPY ./nginx.conf /etc/nginx/nginx.conf

# Create directory for SSL certs
RUN mkdir -p /etc/nginx/certs

# Copy the script to generate SSL certs and start nginx
COPY ./nginx_ssl_setup.sh /usr/local/bin/nginx_ssl_setup.sh
RUN chmod +x /usr/local/bin/nginx_ssl_setup.sh

# Run the script on container startup
CMD ["/usr/local/bin/nginx_ssl_setup.sh"]
