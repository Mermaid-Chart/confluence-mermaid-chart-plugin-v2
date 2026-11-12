import * as jose from 'jose';

const APP_ID = 'ari:cloud:ecosystem::app/32c45076-0ed9-45c6-9e7e-a5d4a00fc88f';
const JWKS_URL = 'https://forge.cdn.prod.atlassian-dev.net/.well-known/jwks.json';
const JWKS = jose.createRemoteJWKSet(new URL(JWKS_URL));

/**
 * Verify the Forge Invocation Token and attach forge context on the request.
 * 401 is reserved for FIT failures. Other errors must return JSON.
 */
export async function requireForgeInvocation(req, res, next) {
    const header = req.headers.authorization || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return res.status(401).json({ error: 'Missing Forge Invocation Token' });
    }

    try {
      const { payload } = await jose.jwtVerify(match[1], JWKS, {
        audience: APP_ID,
        issuer: 'forge/invocation-token',
      });

      const accountId = payload.principal;
      const apiBaseUrl = payload.app?.apiBaseUrl;
      const userToken = req.headers['x-forge-oauth-user'];

      if (!accountId || !apiBaseUrl) {
        return res.status(401).json({ error: 'FIT missing principal or apiBaseUrl' });
      }
      if (!userToken) {
        return res.status(401).json({ error: 'Missing x-forge-oauth-user' });
      }

      req.forge = {
        accountId,
        apiBaseUrl,
        userToken,
        payload,
      };
      return next();
    } catch (err) {
      console.error({ err: err.message }, 'FIT verification failed');
      return res.status(401).json({ error: 'Invalid Forge Invocation Token' });
    }
}
