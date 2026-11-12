function getAnalyticsID() {
  const STORAGE_KEY = 'MERMAIDCHART_ANALYTICS_ID';
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

function sendEvent(eventName, eventID, userLoginState = false, diagramType = 'unknown') {
  const base = window.MC_BASE_URL;
  if (!base) {
    return;
  }
  const payload = {
    analyticsID: getAnalyticsID(),
    eventName,
    eventID,
    diagramType: diagramType || 'unknown',
    userLoginState,
    diagramID: 'unknown',
    pluginSource: 'confluence',
  };
  fetch(`${base}/rest-api/plugins/pulse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch((error) => {
    console.error({ err: error.message }, 'Failed to send analytics event');
  });
}

export default {
  trackConnectToMermaidChart() {
    sendEvent('Confluence Plugin User Logged In', 'CONFLUENCE_PLUGIN_LOGIN', true);
  },
};
