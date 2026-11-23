import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fetchLatestDiagram } from './diagramSync.js';

const documentID = '5f0b6f8e-1c2d-4e3f-9a8b-7c6d5e4f3a2b';
const baseURL = 'https://mermaid.ai';

/** A fetch that answers the document and the SVG requests from a small table. */
function fakeFetch({ document, svg = { status: 200, body: '<svg></svg>' } }) {
  const calls = [];
  const respond = ({ status, body }) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  });
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return respond(url.includes('/raw/') ? svg : document);
  };
  return { fetchImpl, calls };
}

const sync = (fetchImpl) =>
  fetchLatestDiagram({ baseURL, token: 'mc-token', documentID, fetchImpl });

describe('fetchLatestDiagram', () => {
  it('returns the latest code and a freshly rendered SVG', async () => {
    const { fetchImpl, calls } = fakeFetch({
      document: { status: 200, body: { code: 'flowchart LR\n  A --> B' } },
      svg: { status: 200, body: '<svg id="latest"></svg>' },
    });

    assert.deepEqual(await sync(fetchImpl), {
      status: 'synced',
      code: 'flowchart LR\n  A --> B',
      svg: '<svg id="latest"></svg>',
    });
    assert.equal(calls[0].url, `${baseURL}/rest-api/documents/${documentID}`);
    assert.equal(calls[1].url, `${baseURL}/raw/${documentID}?theme=light&format=svg`);
    assert.equal(calls[0].options.headers.Authorization, 'Bearer mc-token');
  });

  it('reports a deleted diagram', async () => {
    const { fetchImpl } = fakeFetch({
      document: {
        status: 404,
        body: { message: 'Sorry, this diagram has been deleted and is no longer accessible.' },
      },
    });
    assert.deepEqual(await sync(fetchImpl), { status: 'deleted' });
  });

  it('reports a diagram the account cannot open', async () => {
    const { fetchImpl } = fakeFetch({
      document: { status: 404, body: { message: 'Sorry, you do not have access to this diagram.' } },
    });
    assert.deepEqual(await sync(fetchImpl), { status: 'no-access' });
  });

  it('treats a 404 without a known reason as unavailable', async () => {
    // Older Mermaid Chart deployments answered "Document Not found" for both cases.
    const { fetchImpl } = fakeFetch({
      document: { status: 404, body: { message: 'Document Not found' } },
    });
    assert.deepEqual(await sync(fetchImpl), { status: 'unavailable' });
  });

  it('asks the user to sign in again when the token is rejected', async () => {
    const { fetchImpl } = fakeFetch({ document: { status: 401, body: { message: 'Unauthorized' } } });
    assert.deepEqual(await sync(fetchImpl), { status: 'signed-out' });
  });

  it('fails when the diagram has no code or the SVG cannot be rendered', async () => {
    const empty = fakeFetch({ document: { status: 200, body: { code: '  ' } } });
    assert.deepEqual(await sync(empty.fetchImpl), { status: 'error' });

    const noSvg = fakeFetch({
      document: { status: 200, body: { code: 'flowchart LR' } },
      svg: { status: 500, body: 'render failed' },
    });
    assert.deepEqual(await sync(noSvg.fetchImpl), { status: 'error' });
  });

  it('rejects an ID that is not a UUID without calling Mermaid Chart', async () => {
    const { fetchImpl, calls } = fakeFetch({ document: { status: 200, body: { code: 'x' } } });
    const result = await fetchLatestDiagram({
      baseURL,
      token: 'mc-token',
      documentID: '../users/me',
      fetchImpl,
    });
    assert.deepEqual(result, { status: 'error' });
    assert.equal(calls.length, 0);
  });
});
