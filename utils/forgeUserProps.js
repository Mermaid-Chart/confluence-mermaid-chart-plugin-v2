/**
 * Read/write the Mermaid Chart token on the Confluence user property
 * using the Forge app user token (x-forge-oauth-user).
 */

async function requestUserProperty({ apiBaseUrl, accountId, userToken, method, body }) {
  const url = `${apiBaseUrl}/wiki/rest/api/user/${encodeURIComponent(accountId)}/property/token${
    method === 'GET' ? '?jsonValue=true' : ''
  }`;
  const res = await fetch(url, {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${userToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

export async function fetchForgeUserToken({ apiBaseUrl, accountId, userToken }) {
  const res = await requestUserProperty({
    apiBaseUrl,
    accountId,
    userToken,
    method: 'GET',
  });
  if (res.status === 404) {
    return '';
  }
  if (!res.ok) {
    const text = await res.text();
    console.error(
      { status: res.status, body: text },
      'Failed on reading user property "token" via Forge',
    );
    throw new Error(`Failed to read user property token (${res.status})`);
  }
  const response = await res.json();
  return (response.value || {}).token || '';
}

export async function saveForgeUserToken({ apiBaseUrl, accountId, userToken, token }) {
  const body = { value: { token } };
  const putRes = await requestUserProperty({
    apiBaseUrl,
    accountId,
    userToken,
    method: 'PUT',
    body,
  });
  if (putRes.ok) {
    return token;
  }

  const postRes = await requestUserProperty({
    apiBaseUrl,
    accountId,
    userToken,
    method: 'POST',
    body,
  });
  if (postRes.ok || postRes.status === 201) {
    return token;
  }

  const text = await postRes.text();
  console.error(
    { putStatus: putRes.status, postStatus: postRes.status, body: text },
    'Failed on saving user property "token" via Forge',
  );
  throw new Error(`Failed to save user property token (${postRes.status})`);
}
