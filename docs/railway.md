# Deploying the frontend on Railway

How to host the Beam Explorer frontend on [Railway](https://railway.com). Only the website runs there. Its data comes from the public BeamTerminal API at `https://beamterminal.0xmx.net/api`, so there's no database, indexer, API or explorer node to run. For the full self-hosted stack, see [deployment.md](deployment.md).

```
 visitor's browser ──── page, JS, CSS ────► Railway: nginx + static bundle
        │
        └────────── /api/* (XHR) ─────────► https://beamterminal.0xmx.net/api
```

## How it works

* [railway/web.Dockerfile](../railway/web.Dockerfile) builds the bundle from source with `yarn build:prod`, so the committed `frontend/html/` isn't used, and serves it with nginx. Both base images are pinned (`node:22.22.2-bookworm-slim`, `nginx:1.28-alpine`); bump them on purpose, and keep the Node tag in step with the version the build is tested with.
* [railway/nginx.conf.template](../railway/nginx.conf.template) serves the files, sends every other path to `index.html` (the single-page app and the legacy `explorer.beam.mw` links), and sets the same cache headers as [nginx.conf](../nginx.conf), plus `no-cache` (revalidate by ETag) for files without a content hash, such as the wasm files and icons. Nothing is proxied.
* [railway/security-headers.conf](../railway/security-headers.conf) is included at server level and in every location that sets its own headers (nginx doesn't inherit `add_header` into those): `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` and `Content-Security-Policy: frame-ancestors 'self'`, with `server_tokens off`. HSTS is left to the Railway edge or your domain, and there's deliberately no full CSP: the app needs wasm, inline styles and cross-origin API calls and images.
* [railway/15-listen-ipv6.envsh](../railway/15-listen-ipv6.envsh) adds the `listen [::]:PORT` line only when the host has IPv6, so nginx still starts where it doesn't.
* The browser calls the API directly: [client.ts](../frontend/src/app/containers/Screener/api/client.ts) uses `https://beamterminal.0xmx.net/api` on every host except `beamterminal.0xmx.net` itself. The API sends `Access-Control-Allow-Origin: *`, so this works from any domain. Each visitor also keeps their own share of the API's per-IP rate limit. Proxying through Railway would put everyone behind one IP and one shared limit.
* Link previews (`og:image`, `twitter:image`) use `https://explorer.beam.mw/og-image.jpg`, a static 1200x630 card in [frontend/src](../frontend/src/og-image.jpg) that webpack copies to the site root. It's a JPEG because X, Facebook and LinkedIn don't render SVG, and it's small enough for WhatsApp's size limit. Replace the file to change the card.
* [railway.json](../railway.json) at the repo root holds the Railway settings: Dockerfile path, health check, restart policy and watch paths. Railway reads it automatically.

## Setup

1. **New Project → Deploy from GitHub repo**, and pick this repository.
2. Leave **Root Directory** empty. The build needs `frontend/` and `railway/` from the repo root.
3. No variables are needed. Railway sets `PORT`, and nginx listens on it.
4. **Settings → Networking → Generate Domain**, or attach a custom domain.

After that, pushes to the deploy branch rebuild the site whenever `frontend/`, `railway/` or `railway.json` change. Backend and docs changes don't trigger a deploy.

## Checks after deploy

```sh
curl -I https://<your-domain>/                              # 200, Cache-Control: no-cache, X-Content-Type-Options, Content-Security-Policy: frame-ancestors 'self'
curl -I https://<your-domain>/amm.wasm                      # 200, Cache-Control: no-cache, ETag
curl -I https://<your-domain>/og-image.jpg                  # 200, image/jpeg
curl -s -o /dev/null -w '%{http_code}\n' https://<your-domain>/explorer/charts   # 200 (SPA fallback)
```

Then open the site. The Charts page should load data, and the footer badge should read `synced · <height>`.

## Things to know

* **The data depends on `beamterminal.0xmx.net`.** If that API is down, or changes or restricts its CORS or rate limits, this site shows empty pages. To remove the dependency, run the backend yourself ([deployment.md](deployment.md)) and point `BASE` in `client.ts` at it.
* **`og:url`, `og:image` and `twitter:image` in [index.html](../frontend/src/index.html)** point at `https://explorer.beam.mw`. If you serve the site from another domain, change them there.
* The DApp Store download buttons and the IPFS links also go to `beamterminal.0xmx.net`, through the same API.
