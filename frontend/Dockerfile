# syntax=docker/dockerfile:1.7
#
# X-tractor web — React SPA served by unprivileged nginx, which also proxies /api to the API.
#   docker build -t premponnada/xtractor-web .
#   docker run -p 8080:8080 -e API_UPSTREAM=http://api:8000 premponnada/xtractor-web
#
# Stages: deps (npm ci, cached) → build (vite build) → runtime (nginx, no Node at all).

ARG NODE_IMAGE=node:24-alpine
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.29-alpine

# ---------------------------------------------------------------- dependencies
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# ---------------------------------------------------------------- build
FROM deps AS build
COPY . .
ENV NODE_ENV=production
RUN npm run build \
    && find dist -name '*.map' -delete   # no source maps in the production image

# ---------------------------------------------------------------- runtime
FROM ${NGINX_IMAGE} AS runtime
LABEL org.opencontainers.image.title="xtractor-web" \
      org.opencontainers.image.description="X-tractor web UI (React) on unprivileged nginx" \
      org.opencontainers.image.source="https://github.com/premkumar-ponnada/X-tractor" \
      org.opencontainers.image.licenses="MIT"
# The official entrypoint renders /etc/nginx/templates/*.template with envsubst at start-up,
# so the API address is configurable per environment without rebuilding.
ENV API_UPSTREAM=http://api:8000 \
    NGINX_ENVSUBST_FILTER=^(API_UPSTREAM|NGINX_LOCAL_RESOLVERS)$
COPY --chown=nginx:nginx nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build --chown=nginx:nginx /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -q --spider http://127.0.0.1:8080/healthz || exit 1
