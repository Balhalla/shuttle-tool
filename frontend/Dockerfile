# Frontend Dockerfile - Multi-stage build
# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Production with nginx (unprivileged)
FROM nginxinc/nginx-unprivileged:alpine

# Copy custom nginx config (for unprivileged nginx on port 8080)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 8080 (nginx-unprivileged default)
EXPOSE 8080

# The nginx-unprivileged image already runs as non-root user (nginx, UID 101)
# Start nginx
CMD ["nginx", "-g", "daemon off;"]
