import { invokeRemote } from '@forge/api';
import resolverModule from '@forge/resolver';

// @forge/resolver is CommonJS; under "type": "module" the default import is its exports object.
const Resolver = resolverModule.default ?? resolverModule;
const resolver = new Resolver();

// Calls from the browser carry the macro config (with the diagram image) in their token header,
// which Vercel refuses as too large (494). Calls from a function carry only the cloud id.
resolver.define('remote', async ({ payload: { path, method }, context }) => {
  const response = await invokeRemote('connect', {
    path,
    method,
    // Forge names the user in the token only for browser calls.
    headers: context.accountId ? { 'x-forge-account-id': context.accountId } : {},
  });
  return { status: response.status, body: await response.text() };
});

export const handler = resolver.getDefinitions();
