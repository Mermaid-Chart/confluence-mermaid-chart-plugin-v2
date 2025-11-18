import {h} from 'https://esm.sh/preact';
import htm from 'https://esm.sh/htm';

const html = htm.bind(h);
let timeout;

export function Login({onLogin, onCancel, onNoLoginClick, onOpenDiagramSelector}) {
  
  const onLoginClick = () => {
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
        <button type="button" class="cancel-button" onClick="${onCancelClick}">
          Cancel
        </button>
      </div>
      
      <div class="confluence-mermaid-chart-container">
        <div class="chart-selection-container">
          <h2>Connect Mermaid Charts with Confluence</h2>
          <p class="description">Bring your diagrams to life inside Confluence. Connect your Mermaid account to create, edit, and sync diagrams seamlessly with your team.</p>
          
          <div class="chart-options">
            <div class="chart-option-column">
              <h3>Continue with Mermaid Chart</h3>
              <p>Access your recent and shared diagrams, keep version history, and sync changes across your team.</p>
              <button id="login-button" class="primary-button" onClick="${onLoginClick}">
                Connect to Mermaid Chart
              </button>
            </div>
            
            <div class="chart-option-column">
              <h3>Quick start without login</h3>
              <p>Start a quick diagram inside Confluence — no account required. Templates and diagram types are available once you open the editor.</p>
              
              <button id="open-editor-button" class="secondary-button" onClick="${onOpenDiagramSelector}">
                Open Editor
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
