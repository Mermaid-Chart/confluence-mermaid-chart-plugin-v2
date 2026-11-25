/**
 * Fetches a macro's diagram as it is now in Mermaid Chart, for the Sync button on the diagram.
 */

// Mermaid Chart's 404 messages (collab `C.DocumentDoesNotExistError` / `C.DocumentNotAccessibleError`).
const deletedMessage = 'Sorry, this diagram has been deleted and is no longer accessible.';
const noAccessMessage = 'Sorry, you do not have access to this diagram.';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function readMessage(response) {
  try {
    const body = await response.json();
    return typeof body?.message === 'string' ? body.message : '';
  } catch {
    return '';
  }
}

/** Why the diagram couldn't be loaded, from Mermaid Chart's answer. */
async function failureStatus(response) {
  if (response.status === 401) {
    return 'signed-out';
  }
  if (response.status === 403) {
    return 'no-access';
  }
  if (response.status !== 404) {
    return 'error';
  }
  const message = await readMessage(response);
  if (message === deletedMessage) {
    return 'deleted';
  }
  return message === noAccessMessage ? 'no-access' : 'unavailable';
}

/**
 * @returns {Promise<
 *   | { status: 'synced', code: string, svg: string }
 *   | { status: 'deleted' | 'no-access' | 'unavailable' | 'signed-out' | 'error' }
 * >}
 */
export async function fetchLatestDiagram({ baseURL, token, documentID, fetchImpl = fetch }) {
  if (!uuidPattern.test(documentID ?? '')) {
    return { status: 'error' };
  }
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

  const documentResponse = await fetchImpl(`${baseURL}/rest-api/documents/${documentID}`, {
    headers,
  });
  if (!documentResponse.ok) {
    return { status: await failureStatus(documentResponse) };
  }
  const { code } = await documentResponse.json();
  if (typeof code !== 'string' || !code.trim()) {
    return { status: 'error' };
  }

  // mermaidchart.com/raw 301s to mermaid.ai, and fetch drops the token on a redirect to another
  // host, so follow it here, sending the token only to Mermaid Chart's own hosts.
  const svgHeaders = { Authorization: headers.Authorization };
  // type=editor draws it as the editor saves it (the user's theme, the diagram's own look and
  // layout), not with /raw's default neo look.
  let svgResponse = await fetchImpl(`${baseURL}/raw/${documentID}?theme=light&format=svg&type=editor`, {
    headers: svgHeaders,
    redirect: 'manual',
  });
  const location = svgResponse.status >= 300 && svgResponse.headers?.get('location');
  if (location) {
    const target = new URL(location, baseURL);
    if (target.protocol === 'https:' && /(^|\.)(mermaidchart\.com|mermaid\.ai)$/.test(target.hostname)) {
      svgResponse = await fetchImpl(target.href, { headers: svgHeaders });
    }
  }
  if (!svgResponse.ok) {
    return { status: 'error' };
  }
  return { status: 'synced', code, svg: await svgResponse.text() };
}
