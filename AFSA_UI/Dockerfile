# ---------- Stage 1: build the Angular app ----------
FROM node:22-alpine AS build

WORKDIR /app

# Install deps first so this layer is cached unless package*.json changes
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build the production bundle
COPY . .
RUN npm run build -- --configuration production

# ---------- Stage 2: serve with nginx ----------
FROM nginx:1.27-alpine AS serve

# Remove default nginx site config and use ours (SPA fallback routing)
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Angular 21's application builder outputs static files under dist/<project>/browser
COPY --from=build /app/dist/afsa-platform/browser /usr/share/nginx/html

# Cloud Run injects $PORT at runtime (defaults to 8080) — nginx.conf listens on 8080
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]