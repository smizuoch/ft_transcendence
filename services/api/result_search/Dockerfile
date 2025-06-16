# Use Node.js 18 Alpine as base image
FROM node:18-alpine

# Install bash and sqlite3 for debugging and database operations
RUN apk add --no-cache bash sqlite

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy prisma schema
COPY prisma ./prisma/

# Generate Prisma client
RUN npx prisma generate

# Copy application source
COPY srcs ./srcs/
COPY nest-cli.json ./
COPY tsconfig.json ./

# Build the application
RUN npm run build

# Create data directory and initialize database
RUN mkdir -p /app/data

# Expose port
EXPOSE 3003

# Start the application with database schema push
CMD ["sh", "-c", "npx prisma db push && npm run start:prod"]
