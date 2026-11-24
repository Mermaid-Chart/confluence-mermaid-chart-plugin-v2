import express from 'express';
import compression from 'compression';
import errorHandler from 'errorhandler';
import morgan from 'morgan';
import path from 'path';
import helmet from 'helmet';
import nocache from 'nocache';

import { MermaidChart } from '../utils/MermaidChart.js';
import { createRedisStore } from '../utils/redisStore.js';
import forgeRoutes from '../routes/forge.js';

const MC_BASE_URL = process.env.MC_BASE_URL || 'https://test.mermaidchart.com';
const LOCAL_BASE_URL =
  process.env.LOCAL_BASE_URL || 'https://confluence.mermaidchart.com';
const PORT = process.env.PORT || 3000;

const app = express();
app.set('port', PORT);

export const devEnv = app.get('env') === 'development';
app.use(morgan(devEnv ? 'dev' : 'combined'));

app.use(
  helmet.hsts({
    maxAge: 31536000,
    includeSubDomains: false,
  }),
);
app.use(
  helmet.referrerPolicy({
    policy: ['origin'],
  }),
);

app.use(express.json({ limit: '5mb' }));
app.use(compression());
app.use(nocache());

// Keep plugin.js (and any other public assets MC still loads) available.
const publicDir = path.join(process.cwd(), 'public');
app.use(express.static(publicDir));

if (devEnv) {
  app.use(errorHandler());
}

const store = createRedisStore();
const mermaidAPI = new MermaidChart({
  baseURL: MC_BASE_URL,
  clientID: process.env.MC_CLIENT_ID || '839d35ba-cfee-4c98-8cee-88f2d2caa0c4',
  redirectURI: `${LOCAL_BASE_URL}/callback`,
  store,
});

forgeRoutes(app, mermaidAPI);

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

app.get('/callback', async (req, res) => {
  let errorMessage;
  try {
    await mermaidAPI.handleAuthorizationResponse(req.query);
  } catch (e) {
    errorMessage = e.message;
  }

  if (errorMessage) {
    res
      .status(400)
      .type('html')
      .send(`<!doctype html><html><body style="display:flex;height:100%;align-items:center;justify-content:center;font-size:24px;font-family:sans-serif">
        Authentication failed.<br/>${escapeHtml(errorMessage)}<br/>Please try again later
      </body></html>`);
    return;
  }

  res
    .type('html')
    .send(`<!doctype html><html><body style="display:flex;height:100%;align-items:center;justify-content:center;font-size:24px;font-family:sans-serif">
      Redirecting...
      <script>window.close();</script>
    </body></html>`);
});

app.get('/', (_req, res) => {
  res.json({ ok: true, app: 'mermaid-chart-for-confluence' });
});

export default app;
