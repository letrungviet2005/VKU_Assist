# ==============================================================================
# VKU Assist Frontend - Production Multi-Stage Dockerfile
# ==============================================================================
# Stage 1: Build static assets with Node.js
FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies with caching
COPY package.json package-lock.json* ./
RUN npm install --silent

# Build production bundle
COPY . .
RUN npm run build

# ==============================================================================
# Stage 2: Serve optimized assets with Nginx
FROM nginx:1.27-alpine AS production

# Copy custom Nginx configuration
COPY ./nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled assets from builder
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
