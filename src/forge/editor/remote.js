import { invokeRemote } from '@forge/bridge';

/**
 * Call the macro resolver endpoint (mc-remote). Returns parsed JSON body on 2xx.
 */
export async function remoteInvoke(path, { method = 'GET' } = {}) {
  const result = await invokeRemote({
    path,
    method,
  });
  const status = result.status ?? result.statusCode;
  if (typeof status !== 'number' || status < 200 || status >= 300) {
    const err = new Error(`Remote ${method} ${path} failed (${status})`);
    err.status = status;
    err.body = result.body;
    throw err;
  }
  return typeof result.body === 'string' ? JSON.parse(result.body) : result.body;
}
