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
          <h2>Sign in to edit Mermaid diagrams in Confluence</h2>
          <p class="description">The Mermaid plugin now requires a Mermaid Chart account to create or edit diagrams. Existing local diagrams remain unchanged and continue to display on the page.</p>
          
          <div class="chart-options chart-options-single">
            <div class="chart-option-column">
              <h3>Continue with Mermaid Chart</h3>
              <p>Sign in to access your diagrams, version history, and team collaboration. Local diagrams stay unchanged until you sign in and import them. Free accounts can save up to 3 diagrams.</p>
              <button id="login-button" class="primary-button" onClick=${onLoginClick}>
                Sign in to Mermaid Chart
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
