import {h} from 'https://esm.sh/preact';
import htm from 'https://esm.sh/htm';
import analytics from '../lib/analytics.js';

const html = htm.bind(h);
let timeout;

export function Login({onLogin, onCancel}) {
  
  const onLoginClick = () => {
    analytics.trackConnectToMermaidChart();
    const width = 500;
    const height = 650;
        const left = (screen.width / 2) - (width / 2);
        const top = (screen.height / 2) - (height / 2);
        let options = 'width=' + width;
        options += ',height=' + height;
        options += ',top=' + top;
        options += ',left=' + left;
        const windowObjectReference = window.open(loginURL, 'loginWindow',
            options);
    windowObjectReference.focus();

    const callback = async () => {
      const res = await fetch(`/check_token?state=${loginState}`, {
        headers: {
          Authorization: `JWT ${JWTToken}`,
        },
      });
      if (res.ok) {
        const body = await res.json();
        onLogin(body.token, body.user);
      } else {
        timeout = setTimeout(callback, 500);
      }
        }
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    timeout = setTimeout(callback, 500);

    return false;
  };

  const onCancelClick = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    if (onCancel && typeof onCancel === "function") {
      onCancel();
    }
    return false;
  };

  return html`
    <div class="iframe-container">
      <div class="iframe-cancel">
        <button type="button" class="cancel-button" onClick=${onCancelClick}>
          Cancel
        </button>
      </div>
      
      <div class="confluence-mermaid-chart-container">
        <div class="chart-selection-container">
          <h2>Connect Mermaid Charts with Confluence</h2>
          <p class="description">Sign in to Mermaid Chart to create, edit, and sync diagrams in Confluence. Existing diagrams on this page keep working — connect to continue editing them.</p>
          
          <div class="chart-options chart-options-single">
            <div class="chart-option-column">
              <h3>Continue with Mermaid Chart</h3>
              <p>Access your recent and shared diagrams, keep version history, and sync changes across your team. Free accounts can save up to 3 diagrams.</p>
              <button id="login-button" class="primary-button" onClick=${onLoginClick}>
                Connect to Mermaid Chart
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
