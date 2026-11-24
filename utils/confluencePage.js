/**
 * Saves a synced diagram into the Confluence page that shows it, using the
 * signed-in user's app token, so the page keeps the new version after a reload.
 */

import { applyDiagramToAdf } from '../shared/js/macroAdf.js';

// The macro config budget the editor keeps to (shared/js/imageUtils.js sizeConfig.maxRequestSize).
const maxDiagramBytes = 1048576;

/**
 * @returns {Promise<'saved' | 'unchanged' | 'not-on-page' | 'no-page-access' | 'too-large' | 'error'>}
 */
export async function saveDiagramToPage({
  apiBaseUrl,
  userToken,
  pageId,
  documentID,
  code,
  svg,
  fetchImpl = fetch,
  now = Date.now,
}) {
  if (!/^\d+$/.test(String(pageId ?? ''))) {
    return 'error';
  }
  // Stored the way the editor stores it: base64 SVG in diagramCode.
  const diagramCode = Buffer.from(svg, 'utf8').toString('base64');
  if (diagramCode.length + code.length > maxDiagramBytes) {
    return 'too-large';
  }

  const pageUrl = `${apiBaseUrl}/wiki/api/v2/pages/${pageId}`;
  const headers = { Accept: 'application/json', Authorization: `Bearer ${userToken}` };

  // A second try covers someone publishing the page between our read and write.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const pageResponse = await fetchImpl(`${pageUrl}?body-format=atlas_doc_format`, { headers });
    if (pageResponse.status === 403 || pageResponse.status === 404) {
      return 'no-page-access';
    }
    if (!pageResponse.ok) {
      console.error({ status: pageResponse.status }, 'sync: reading the page failed');
      return 'error';
    }
    const page = await pageResponse.json();
    const adf = JSON.parse(page.body?.atlas_doc_format?.value || 'null');
    if (!adf || typeof page.version?.number !== 'number') {
      return 'error';
    }

    const { matched, changed } = applyDiagramToAdf(adf, documentID, {
      diagramCode,
      mcSourceCode: code,
      updatedAt: String(now()),
    });
    if (!matched) {
      return 'not-on-page';
    }
    if (!changed) {
      return 'unchanged';
    }

    const updateResponse = await fetchImpl(pageUrl, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: page.id,
        status: 'current',
        title: page.title,
        body: { representation: 'atlas_doc_format', value: JSON.stringify(adf) },
        version: { number: page.version.number + 1, message: 'Synced Mermaid Chart diagram' },
      }),
    });
    if (updateResponse.ok) {
      return 'saved';
    }
    if (updateResponse.status === 403) {
      return 'no-page-access';
    }
    if (updateResponse.status !== 409) {
      console.error({ status: updateResponse.status }, 'sync: saving the page failed');
      return 'error';
    }
  }
  return 'error';
}
