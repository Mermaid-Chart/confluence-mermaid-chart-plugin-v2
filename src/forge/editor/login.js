import { h } from 'preact';
import htm from 'htm';
import { router } from '@forge/bridge';
import analytics from './analytics.js';
import { remoteInvoke } from './remote.js';

const html = htm.bind(h);
let timeout;

export function Login({ loginURL, loginState, onLogin, onCancel }) {
  const onLoginClick = () => {
    analytics.trackConnectToMermaidChart();
    // Custom UI iframes are sandboxed without allow-popups; window.open is blocked.
    router.open(loginURL);

    // Stop polling if sign-in is abandoned; clicking Sign in again restarts it.
    const deadline = Date.now() + 10 * 60 * 1000;
    const callback = async () => {
      try {
        const body = await remoteInvoke(
          `/forge/check_token?state=${encodeURIComponent(loginState)}`,
        );
        onLogin(body.token, body.user);
      } catch {
        timeout = Date.now() < deadline ? setTimeout(callback, 500) : null;
      }
    };
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
    if (onCancel && typeof onCancel === 'function') {
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
          <p class="description">
            The Mermaid plugin now requires a Mermaid Chart account to create or
            edit diagrams. Existing local diagrams remain unchanged and continue
            to display on the page.
          </p>

          <div class="chart-options chart-options-single">
            <div class="chart-option-column">
              <h3>Continue with Mermaid Chart</h3>
              <p>
                Sign in to access your diagrams, version history, and team
                collaboration. Local diagrams stay unchanged until you sign in
                and import them. Free accounts can save up to 3 diagrams.
              </p>
              <button
                id="login-button"
                class="primary-button"
                onClick=${onLoginClick}
              >
                Sign in to Mermaid Chart
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
