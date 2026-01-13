import httpClient from './httpClient.js';

class Analytics {

    constructor() {
    this.analyticsID = getAnalyticsID();
  }

  sendEvent(eventName, eventID, userLoginState = false) {
    const payload = {
      analyticsID: this.analyticsID,
      eventName,
      eventID,
      diagramType: 'unknown',
      userLoginState: userLoginState,
      diagramID: 'unknown',
      pluginSource: 'confluence'
    };

    httpClient.post('/rest-api/plugins/pulse', payload).catch((error) => {
      console.error('Failed to send analytics event:', error);
    });
  }

     trackConnectToMermaidChart() {
    this.sendEvent(
      'Confluence Plugin User Logged In', 
      'CONFLUENCE_PLUGIN_LOGIN', 
      true   
    );
  }

 trackDiagramInsertedNoAuth() {
  this.sendEvent(
    'Plugin diagram insert',
    'PLUGIN_DIAGRAM_INSERT'
  );
}

 
trackDiagramEditedNoAuth() {
  this.sendEvent(
    'Plugin diagram edit',
    'PLUGIN_DIAGRAM_EDIT'
  );
}

  trackPluginDiagramEdit(diagram) {
    this.sendEvent(
      'Plugin diagram edit',
      'PLUGIN_DIAGRAM_EDIT',
      true     
    );
  }


trackEditorOpenedNoAuth() {
  this.sendEvent(
    'Confluence Editor Opened – No Login',
    'CONFLUENCE_EDITOR_OPENED_NO_AUTH'
  );
}

}

function getAnalyticsID() {
  const STORAGE_KEY = 'MERMAIDCHART_ANALYTICS_ID';

  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}
export default new Analytics();
