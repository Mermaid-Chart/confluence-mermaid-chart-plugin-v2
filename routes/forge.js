import { requireForgeInvocation } from '../utils/forgeAuth.js';
import { fetchForgeUserToken, saveForgeUserToken } from '../utils/forgeUserProps.js';

const MC_BASE_URL = process.env.MC_BASE_URL || 'https://test.mermaidchart.com';

/**
 * Forge Remote routes, called from the Custom UI editor through invokeRemote.
 */
export default function forgeRoutes(app, mermaidAPI) {
  app.get('/forge/editor-init', requireForgeInvocation, async (req, res) => {
    try {
      const { accountId, apiBaseUrl, userToken } = req.forge;
      let accessToken = '';
      let user = null;

      try {
        accessToken = await fetchForgeUserToken({ apiBaseUrl, accountId, userToken });
        user = accessToken ? await mermaidAPI.getUser(accessToken) : null;
      } catch (e) {
        console.error({ err: e.message }, 'editor-init: existing token check failed');
        accessToken = '';
        user = null;
      }

      const auth = user
        ? {}
        : await mermaidAPI.getAuthorizationData({
            trackingParams: {
              utm_source: 'mermaid_chart_confluence_plugin',
              utm_medium: 'confluence',
              utm_campaign: 'confluence_plugin',
            },
          });

      return res.json({
        MC_BASE_URL,
        mcAccessToken: user ? accessToken : '',
        loginURL: auth.url || '',
        loginState: auth.state || '',
        user,
      });
    } catch (e) {
      console.error({ err: e.message }, 'editor-init failed');
      return res.status(500).json({ error: 'editor-init failed', details: e.message });
    }
  });

  app.get('/forge/check_token', requireForgeInvocation, async (req, res) => {
    try {
      if (!req.query.state) {
        return res.status(404).json({ error: 'Missing state' });
      }

      const token = await mermaidAPI.getToken(req.query.state);
      if (!token) {
        return res.status(404).json({ error: 'Token not ready' });
      }
      const user = await mermaidAPI.getUser(token);
      const { accountId, apiBaseUrl, userToken } = req.forge;

      try {
        await saveForgeUserToken({
          apiBaseUrl,
          accountId,
          userToken,
          token,
        });
        // Drop the sign-in state only once the token is saved, so a failed save can be retried.
        await mermaidAPI.delToken(req.query.state);
        return res.json({ token, user });
      } catch (e) {
        console.error({ err: e.message }, 'check_token: save failed');
        return res.status(503).json({ error: 'Failed to save token', details: e.message });
      }
    } catch (e) {
      console.error({ err: e.message }, 'check_token failed');
      return res.status(500).json({ error: 'check_token failed', details: e.message });
    }
  });

  app.post('/forge/logout', requireForgeInvocation, async (req, res) => {
    try {
      const { accountId, apiBaseUrl, userToken } = req.forge;
      await saveForgeUserToken({
        apiBaseUrl,
        accountId,
        userToken,
        token: '',
      });
      return res.json({ ok: true });
    } catch (e) {
      console.error({ err: e.message }, 'logout failed');
      return res.status(500).json({ error: 'logout failed', details: e.message });
    }
  });
}
