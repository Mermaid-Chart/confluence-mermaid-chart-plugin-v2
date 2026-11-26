/**
 * Clears the sign-in cookie that Mermaid Chart keeps for the editor.
 *
 * Each time the Edit window opens the editor, /oauth/frame sets a cookie that holds the
 * signed-in account's token. Mermaid Chart reads it before the browser's own login, so a
 * cookie left from account A makes the next "Sign in" open as account A, even when the
 * browser is signed in as account B. The cookie is HttpOnly and set from a cross-site frame,
 * so only a request from a frame can remove it. /oauth/frame removes it, with the attributes
 * the browser needs, when it is given a token it doesn't accept.
 * @param {string} baseURL Mermaid Chart base URL.
 * @returns {Promise<void>} Resolves when the frame has loaded, or after a short timeout.
 */
export function clearMermaidChartSession(baseURL) {
    if (!baseURL) {
        return Promise.resolve();
    }
    return new Promise((resolve) => {
        const frame = document.createElement('iframe');
        frame.hidden = true;
        frame.tabIndex = -1;
        frame.setAttribute('aria-hidden', 'true');
        const finish = () => {
            clearTimeout(timer);
            frame.remove();
            resolve();
        };
        const timer = setTimeout(finish, 5000);
        frame.addEventListener('load', finish, { once: true });
        frame.src = `${baseURL}/oauth/frame/?token=signed-out&redirect=/`;
        document.body.appendChild(frame);
    });
}
