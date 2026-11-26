import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyDiagramToAdf } from '../shared/js/macroAdf.js';
import { saveDiagramToPage } from './confluencePage.js';

const documentID = '5f0b6f8e-1c2d-4e3f-9a8b-7c6d5e4f3a2b';
const otherID = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const apiBaseUrl = 'https://api.example.test/ex/confluence/cloud-1';
const svg = '<svg id="latest"></svg>';
const svgBase64 = Buffer.from(svg, 'utf8').toString('base64');

function forgeMacro(id, extra = {}) {
  return {
    type: 'extension',
    attrs: { parameters: { guestParams: { documentID: id, diagramCode: 'old', mcSourceCode: 'graph TD', ...extra } } },
  };
}

function pageWith(...macros) {
  return {
    id: '123',
    title: 'Architecture',
    version: { number: 7 },
    body: {
      atlas_doc_format: {
        value: JSON.stringify({ type: 'doc', version: 1, content: [{ type: 'paragraph' }, ...macros] }),
      },
    },
  };
}

/** A fetch that serves the page on GET and records PUTs; `putStatuses` answers each PUT in turn. */
function fakeConfluence({ page, getStatus = 200, putStatuses = [200] }) {
  const puts = [];
  const fetchImpl = async (url, options = {}) => {
    if (options.method === 'PUT') {
      puts.push({ url, body: JSON.parse(options.body) });
      const status = putStatuses[puts.length - 1] ?? 200;
      return { ok: status >= 200 && status < 300, status };
    }
    return { ok: getStatus === 200, status: getStatus, json: async () => page };
  };
  return { fetchImpl, puts };
}

const save = (fetchImpl, overrides = {}) =>
  saveDiagramToPage({
    apiBaseUrl,
    userToken: 'user-token',
    pageId: '123',
    documentID,
    code: 'flowchart LR',
    svg,
    fetchImpl,
    now: () => 1700000000000,
    ...overrides,
  });

describe('applyDiagramToAdf', () => {
  it('updates every macro linked to the diagram and leaves the others alone', () => {
    const adf = {
      type: 'doc',
      content: [
        forgeMacro(documentID),
        { type: 'layoutSection', content: [{ type: 'layoutColumn', content: [forgeMacro(documentID)] }] },
        forgeMacro(otherID),
      ],
    };
    const result = applyDiagramToAdf(adf, documentID, {
      diagramCode: 'new',
      mcSourceCode: 'flowchart LR',
      updatedAt: '1',
    });

    assert.deepEqual(result, { matched: 2, changed: 2 });
    assert.equal(adf.content[0].attrs.parameters.guestParams.diagramCode, 'new');
    assert.equal(adf.content[1].content[0].content[0].attrs.parameters.guestParams.mcSourceCode, 'flowchart LR');
    assert.equal(adf.content[2].attrs.parameters.guestParams.diagramCode, 'old');
  });

  it('updates macros saved by the Connect app in their { value } shape', () => {
    const adf = {
      type: 'doc',
      content: [{ type: 'extension', attrs: { parameters: { macroParams: { documentID: { value: documentID } } } } }],
    };
    applyDiagramToAdf(adf, documentID, { diagramCode: 'new', mcSourceCode: 'graph', updatedAt: '1' });
    assert.deepEqual(adf.content[0].attrs.parameters.macroParams.diagramCode, { value: 'new' });
  });
});

describe('saveDiagramToPage', () => {
  it('saves the new diagram as the next page version', async () => {
    const { fetchImpl, puts } = fakeConfluence({ page: pageWith(forgeMacro(documentID)) });

    assert.equal(await save(fetchImpl), 'saved');
    assert.equal(puts.length, 1);
    assert.equal(puts[0].url, `${apiBaseUrl}/wiki/api/v2/pages/123`);
    assert.equal(puts[0].body.version.number, 8);
    const saved = JSON.parse(puts[0].body.body.value).content[1].attrs.parameters.guestParams;
    assert.deepEqual(
      { diagramCode: saved.diagramCode, mcSourceCode: saved.mcSourceCode, updatedAt: saved.updatedAt },
      { diagramCode: svgBase64, mcSourceCode: 'flowchart LR', updatedAt: '1700000000000' },
    );
  });

  it('does not create a page version when the diagram is already up to date', async () => {
    const page = pageWith(forgeMacro(documentID, { diagramCode: svgBase64, mcSourceCode: 'flowchart LR' }));
    const { fetchImpl, puts } = fakeConfluence({ page });
    assert.equal(await save(fetchImpl), 'unchanged');
    assert.equal(puts.length, 0);
  });

  it('reports a page that no longer holds the macro', async () => {
    const { fetchImpl } = fakeConfluence({ page: pageWith(forgeMacro(otherID)) });
    assert.equal(await save(fetchImpl), 'not-on-page');
  });

  it('reports a user who cannot edit the page', async () => {
    const { fetchImpl } = fakeConfluence({ page: pageWith(forgeMacro(documentID)), putStatuses: [403] });
    assert.equal(await save(fetchImpl), 'no-page-access');
  });

  it('retries once on the newest version when the page changed meanwhile', async () => {
    const { fetchImpl, puts } = fakeConfluence({
      page: pageWith(forgeMacro(documentID)),
      putStatuses: [409, 200],
    });
    assert.equal(await save(fetchImpl), 'saved');
    assert.equal(puts.length, 2);
  });

  it('refuses a diagram over the macro size budget without calling Confluence', async () => {
    const { fetchImpl, puts } = fakeConfluence({ page: pageWith(forgeMacro(documentID)) });
    assert.equal(await save(fetchImpl, { svg: `<svg>${'x'.repeat(800000)}</svg>` }), 'too-large');
    assert.equal(puts.length, 0);
  });

  it('rejects a page ID that is not numeric', async () => {
    const { fetchImpl, puts } = fakeConfluence({ page: pageWith(forgeMacro(documentID)) });
    assert.equal(await save(fetchImpl, { pageId: '../spaces' }), 'error');
    assert.equal(puts.length, 0);
  });
});
