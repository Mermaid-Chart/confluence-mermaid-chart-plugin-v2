import {h} from 'https://esm.sh/preact';
import htm from 'https://esm.sh/htm';

const html = htm.bind(h);
let timeout;

export function Login({onLogin}) {
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

    return html`
        <div id="login-container">
            <img src="/icon_80x80.png" class="logo" alt="MermaidChart" />
            <div>To access your diagram, log into your Mermaid Chart account</div>
            <button id="login-button" onClick="${onLoginClick}">
                Connect to MermaidChart
            </button>
        </div>
    `;
}
