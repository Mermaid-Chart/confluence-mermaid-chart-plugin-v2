import { h, render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import htm from 'htm';
import { view } from '@forge/bridge';
import { Login } from './login.js';
import { Form } from './form.js';
import { remoteInvoke } from './remote.js';
import '../../../shared/css/general.css';
import '../../../shared/css/editor.css';

const html = htm.bind(h);

function App() {
  const [boot, setBoot] = useState({ loading: true, error: null });
  const [accessToken, setAccessToken] = useState('');
  const [user, setUser] = useState(null);
  const [loginURL, setLoginURL] = useState('');
  const [loginState, setLoginState] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const init = await remoteInvoke('/forge/editor-init');
        if (cancelled) {
          return;
        }
        window.MC_BASE_URL = init.MC_BASE_URL;
        setAccessToken(init.mcAccessToken || '');
        setUser(init.user || null);
        setLoginURL(init.loginURL || '');
        setLoginState(init.loginState || '');
        setBoot({ loading: false, error: null });
      } catch (e) {
        console.error({ err: e.message }, 'editor-init failed');
        if (!cancelled) {
          setBoot({ loading: false, error: e.message || 'Failed to start editor' });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onLogin = (token, nextUser) => {
    setAccessToken(token);
    setUser(nextUser);
  };

  const onCancel = () => {
    view.close();
  };

  const onLogout = async () => {
    try {
      await remoteInvoke('/forge/logout', { method: 'POST' });
    } catch (e) {
      console.error({ err: e.message }, 'logout failed');
    }
    setAccessToken('');
    setUser(null);
    try {
      const init = await remoteInvoke('/forge/editor-init');
      window.MC_BASE_URL = init.MC_BASE_URL;
      setLoginURL(init.loginURL || '');
      setLoginState(init.loginState || '');
    } catch (e) {
      console.error({ err: e.message }, 'editor-init after logout failed');
    }
  };

  if (boot.loading) {
    return html`
      <div id="page-spinner">
        <img src="./spinner.svg" alt="Loading" />
      </div>
    `;
  }

  if (boot.error) {
    return html`
      <div id="page-spinner" style="flex-direction: column;">
        <h2 class="error">${boot.error}</h2>
        <button type="button" class="cancel-button" onClick=${onCancel}>
          Close
        </button>
      </div>
    `;
  }

  if (!accessToken) {
    return html`
      <${Login}
        loginURL=${loginURL}
        loginState=${loginState}
        onLogin=${onLogin}
        onCancel=${onCancel}
      />
    `;
  }

  return html`
    <${Form} user=${user} onLogout=${onLogout} mcAccessToken=${accessToken} />
  `;
}

render(html`<${App} />`, document.getElementById('editor-content'));
