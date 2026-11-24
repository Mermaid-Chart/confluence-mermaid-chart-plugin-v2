# Mermaid Chart for Confluence

Forge app for Confluence. It is the same Marketplace app as the old Connect app, not a second app: `app.connect.key` in `manifest.yml` keeps the Connect key so existing installs and saved diagrams carry over.

## How it works

| Part | Where it runs | What it does |
|---|---|---|
| Viewer (`src/forge/viewer`) | Forge Custom UI, hosted by Atlassian | Renders the saved diagram image from the macro config. Never calls our server. |
| Editor (`src/forge/editor`) | Forge Custom UI, hosted by Atlassian | Signs the user in to Mermaid Chart, then shows the Mermaid Chart editor in an iframe and saves the result into the macro config. |
| Remote server (`api/index.js`) | Vercel, `https://confluence.mermaidchart.com` | Mermaid Chart sign-in, token storage, and `public/js/plugin.js`. |

Editing a diagram:

```
Confluence page
 └─ Forge editor (Custom UI, *.cdn.prod.atlassian-dev.net)
     ├─ invokeRemote GET /forge/editor-init      → remote returns MC_BASE_URL + user or a sign-in URL
     ├─ router.open(sign-in URL)                 → Mermaid Chart OAuth → GET /callback on the remote
     ├─ invokeRemote GET /forge/check_token      → polled every 500ms until the token is stored (404 until then)
     └─ <iframe> ${MC_BASE_URL}/oauth/frame/?token=…&redirect=…  → Mermaid Chart editor
            └─ plugin.js postMessage save/cancel/logout → view.submit({ config }) / view.close()
```

- `invokeRemote` goes through the macro's `resolver.endpoint` (`mc-remote`) to the `connect` remote. Forge signs every call with a Forge Invocation Token (FIT) and, because `appUserToken` is enabled, adds the user's token in `x-forge-oauth-user`.
- `utils/forgeAuth.js` verifies the FIT against Atlassian's JWKS (audience = the app id) on every `/forge/*` route.
- The Mermaid Chart token is stored per user in a Confluence user property (`utils/forgeUserProps.js`), using the app user token. Redis only holds the short-lived sign-in state; it does not store diagrams.
- Diagrams are saved in the macro config (`diagramCode` holds the image, `mcSourceCode` the Mermaid source). Older Connect saves are still read from `diagramImage` or the legacy body (`__bodyContent`).

Remote routes:

| Route | Purpose |
|---|---|
| `GET /forge/editor-init` | Returns `MC_BASE_URL`, the stored Mermaid Chart user and token, or a new sign-in URL + state. |
| `GET /forge/check_token?state=` | Returns the token once sign-in has finished and saves it to the user property; 404 until then. |
| `POST /forge/logout` | Clears the stored token. |
| `GET /callback` | OAuth redirect target for Mermaid Chart sign-in. |

## What deploys where

| Change | Deploy |
|---|---|
| Viewer, editor, `manifest.yml` | `npm run build:forge`, then `forge deploy` |
| Remote server (`api/`, `routes/`, `utils/`, `public/`) | Vercel |

Do not deploy to staging or production until the app has been installed and checked on the Forge **development** environment.

## Forge app

```bash
npm install
npm run build:forge          # builds static/viewer and static/editor, then forge lint
forge login
forge deploy -e development
forge install -e development -p confluence -s <site>.atlassian.net
```

After a manifest change that adds permissions or egress, deploy and upgrade the existing install:

```bash
forge deploy -e development
forge install --upgrade -e development -p confluence -s <site>.atlassian.net
```

Production: `forge deploy -e production`. A site admin approves new permissions on the next upgrade.

## Remote server

Environment variables (Vercel, or `.env` locally; see `.env.example`):

| Variable | Meaning |
|---|---|
| `MC_BASE_URL` | Mermaid Chart site the editor iframes. Defaults to `https://test.mermaidchart.com`; set the production URL in Vercel. Its host must be in `manifest.yml` `permissions.external.frames`. |
| `LOCAL_BASE_URL` | Public URL of this server. Mermaid Chart redirects to `${LOCAL_BASE_URL}/callback`, which must be registered for the Confluence client in Mermaid Chart. |
| `MC_CLIENT_ID` | Mermaid Chart OAuth client id. |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` (or `DB_URL` / `DB_TOKEN`) | Redis for the sign-in state. |

Mermaid Chart (collab) must allow the Forge Custom UI host in its CSP `frame-ancestors` (`https://*.cdn.prod.atlassian-dev.net`), otherwise the editor iframe shows "refused to connect".

## Local development

1. Copy `.env.example` to `.env` and `credentials.json.sample` to `credentials.json` (ngrok authtoken + reserved domain). Both files are gitignored.
2. `npm start` runs the server on `PORT` and, in development, opens an ngrok tunnel to it from `credentials.json`.
3. Use your own Forge app for local testing. Locally, and never committed, point `manifest.yml` at it: your `app.id`, the ngrok domain as `remotes[connect].baseUrl`, and your local Mermaid Chart host in `permissions.external.frames`. Set the same app id as `APP_ID` in `utils/forgeAuth.js`, and set `LOCAL_BASE_URL` in `.env` to the ngrok domain.
4. `npm run build:forge`, `forge deploy -e development`, then install or upgrade on your test site.

Troubleshooting:

| Symptom | Cause |
|---|---|
| HTTP 431 in the editor, no line in the server log | The FIT header is larger than Node's limit. `scripts/server.js` raises `maxHeaderSize`; make sure only one server holds the port. |
| "Invalid response from remote – remote network error" | `permissions.external.fetch.backend` is missing `- remote: connect`, or the server/tunnel is down. |
| "This content is blocked. Contact the site owner" | The Mermaid Chart host is missing from `permissions.external.frames`. |
| "<host> refused to connect" + `frame-ancestors` console error | Mermaid Chart's CSP does not allow `*.cdn.prod.atlassian-dev.net`. |
| Sign-in button does nothing | Custom UI is sandboxed without popups; sign-in must use `router.open`. |
| `/forge/check_token` 404 repeatedly | Expected until sign-in finishes. |

## Mermaid Chart editor bridge

The Mermaid Chart page inside the editor iframe loads:

```html
<script src="https://confluence.mermaidchart.com/js/plugin.js"></script>
```

Then it calls `window.CP.saveData(...)`, `window.CP.cancel()`, or `window.CP.invalidateToken()`. `window.CP.getData()` returns the current diagram. The editor only accepts these messages from its own iframe. A sample page is in `example/index.html`.
