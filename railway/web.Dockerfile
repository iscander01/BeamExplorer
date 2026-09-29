# syntax=docker/dockerfile:1.7
#
# Railway: builds the frontend bundle and serves it as static files with
# nginx. Frontend only — the bundle reads data from the public BeamTerminal API
# (https://beamterminal.0xmx.net/api). Build context: the repo root.
# See docs/railway.md.

# Node is pinned to the exact release the build was tested with (v22.22.2);
# bump it deliberately, not by whatever "22" points at on build day.
FROM node:22.22.2-bookworm-slim AS build
WORKDIR /app/frontend
# Yarn version is pinned via "packageManager" in frontend/package.json.
RUN corepack enable
COPY frontend/package.json frontend/yarn.lock frontend/.yarnrc.yml ./
RUN yarn install --immutable
COPY frontend/ ./
RUN yarn build:prod

FROM nginx:1.28-alpine
# The image renders /etc/nginx/templates/*.template into conf.d with envsubst
# at startup. Railway injects PORT; 8080 is the fallback for local runs.
ENV PORT=8080
# Empty default, so the template still renders if the script below is skipped
# (it only adds the IPv6 listener; see 15-listen-ipv6.envsh).
ENV LISTEN_IPV6=""
COPY railway/nginx.conf.template /etc/nginx/templates/default.conf.template
# Sourced by the image's entrypoint before envsubst runs; it must be executable.
COPY --chmod=755 railway/15-listen-ipv6.envsh /docker-entrypoint.d/15-listen-ipv6.envsh
COPY railway/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/frontend/html /usr/share/nginx/html
