import {h, render} from 'https://esm.sh/preact';
import {useState} from 'https://esm.sh/preact/hooks';
import htm from 'https://esm.sh/htm';
import {Login} from './login.js';
import {Form} from './form.js';

const html = htm.bind(h);

function App() {
    const [accessToken, setAccessToken] = useState(mcAccessToken);
    const [user, setUser] = useState(loggedUser);

    const onLogin = (token, user) => {
        setAccessToken(token);
        setUser(user);
    }
    
    const onCancel = () => {
        if (window.AP && window.AP.confluence) {
            window.AP.confluence.closeMacroEditor();
        } else if (window.CP) {
            window.CP.cancel();
        }
    }
    
    const onLogout = async () => {
        await fetch('/logout', {
                method: 'post',
                headers: {
                    Authorization: `JWT ${JWTToken}`,
                },
            });
        setAccessToken(undefined)
        setUser(null)
    }

    if (!accessToken) {
        return html`
            <${Login} onLogin="${onLogin}" onCancel="${onCancel}"/>
        `;
    }

    return html`
        <${Form} user="${user}" onLogout="${onLogout}"
                 mcAccessToken="${accessToken}"/>
    `;
}

render(html`
    <${App}/>`, document.getElementById('editor-content'));
