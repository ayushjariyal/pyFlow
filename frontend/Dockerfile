# Frontend image — build the React app, then serve the static files with nginx.

# --- Stage 1: build ---
FROM node:22-alpine AS build
WORKDIR /app

# Install deps first (cached unless package files change).
COPY package*.json ./
RUN npm ci

# The browser talks to the API directly, so this URL must be reachable from the
# user's machine — i.e. the API's published port on the host.
ARG VITE_API_BASE_URL=http://localhost:8000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY . .
RUN npm run build

# --- Stage 2: serve ---
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
