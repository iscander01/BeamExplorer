# syntax=docker/dockerfile:1.7
#
# Railway: builds the frontend bundle and serves it as static files with
# nginx. Frontend only — the bundle reads data from the public BeamTerminal API
# (https://beamterminal.0xmx.net/api). Build context: the repo root.
# See docs/railway.md.

FROM node:22-bookworm-slim AS build
WORKDIR /app/frontend
# Yarn version is pinned via "packageManager" in frontend/package.json.
RUN corepack enable
COPY frontend/package.json frontend/yarn.lock frontend/.yarnrc.yml ./
RUN yarn install --immutable
COPY frontend/ ./
RUN yarn build:prod

FROM nginx:1.27-alpine
# The image renders /etc/nginx/templates/*.template into conf.d with envsubst
# at startup. Railway injects PORT; 8080 is the fallback for local runs.
ENV PORT=8080
COPY railway/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/frontend/html /usr/share/nginx/html
