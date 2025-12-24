import httpClient from './httpClient.js';

class Analytics {

    constructor() {
    this.analyticsID = getAnalyticsID();
  }

 

  sendEvent(eventName, eventID, diagramType, userLoginState = false) {
    const payload = {
      analyticsID: this.analyticsID,
      eventName,
      eventID,
      diagramType,
      userLoginState,
    };

    httpClient.post('/rest-api/plugins/pulse', payload).catch((error) => {
      console.error('Failed to send analytics event:', error);
    });
  }

    trackConnectToMermaidChart() {
    this.sendEvent('Confluence Plugin User Logged In', 'CONFLUENCE_PLUGIN_LOGIN', undefined, true);
  }
  /**
   * Track when non-logged-in user inserts/saves a diagram
   */
 trackDiagramInsertedNoAuth() {
  console.log('[Analytics] Confluence diagram inserted – no login');
  this.sendEvent(
    'Confluence Diagram Inserted – No Login',
    'CONFLUENCE_DIAGRAM_INSERTED_NO_AUTH'
  );
}

  /** 
   * Track when a diagram is created
   */
  trackDiagramCreated() {
    console.log('Tracking diagram created');
    this.sendEvent(
      'Diagram Created',
      'DIAGRAM_CREATED',
    );
  }
 
  /**
   * Track when a diagram is edited
   */
trackDiagramEditedNoAuth() {
  console.log('[Analytics] Confluence diagram edited – no login');
  this.sendEvent(
    'Confluence Diagram Edited – No Login',
    'CONFLUENCE_DIAGRAM_EDITED_NO_AUTH'
  );
}

  /**
   * Track when no-login editor is used/opened
   */
trackEditorOpenedNoAuth() {
  console.log('[Analytics] Confluence editor opened – no login');
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
