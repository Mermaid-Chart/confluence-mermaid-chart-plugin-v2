import { router } from '@forge/bridge';
import { remoteInvoke } from '../editor/remote.js';
import './sync.css';

const SYNC_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M13.5 8a5.5 5.5 0 0 1-9.4 3.9M2.5 8a5.5 5.5 0 0 1 9.4-3.9M12.5 1.5v2.6H9.9M3.5 14.5v-2.6h2.6"/></svg>';

const EDIT = 'Edit this page and open the diagram';

/** Shown in normal text; every other status is an error. */
const INFO_STATUSES = new Set(['syncing', 'updated', 'unchanged']);

/** One-line explanation when the diagram can't be synced. */
function syncMessage(status) {
    const messages = {
        deleted: `This diagram was deleted from Mermaid Chart. ${EDIT} to import the copy saved on this page.`,
        'no-access': `This diagram is in a Mermaid Chart account you can't open. ${EDIT} to ask the owner for access.`,
        unavailable: `This diagram couldn't be loaded from your Mermaid Chart account. ${EDIT} to see why.`,
        'signed-out': 'Sign in to Mermaid Chart to sync this diagram.',
        unchanged: 'This diagram is already up to date.',
        syncing: 'Syncing with Mermaid Chart…',
        updated: 'Diagram updated.',
        'no-page-access': 'You need permission to edit this page to sync this diagram.',
        'not-on-page': "This diagram isn't on the published page yet. Publish the page, then sync.",
        'too-large': `The latest version is too large to save here. ${EDIT} to save a smaller copy.`,
    };
    return messages[status] ?? "Couldn't sync this diagram. Please try again.";
}

/** The backend saves the latest diagram into the published page as a new version. */
function syncOnPage(documentID, pageId) {
    const query = new URLSearchParams({ documentID, pageId });
    return remoteInvoke(`/forge/sync?${query}`, { method: 'POST' });
}

/**
 * Opens Mermaid Chart sign-in in a new tab, as the editor does, and resolves once the
 * remote has stored the token. Rejects if sign-in is not finished within 10 minutes.
 */
async function signIn() {
    const init = await remoteInvoke('/forge/editor-init');
    if (init.user) {
        return;
    }
    // Custom UI iframes are sandboxed without allow-popups; window.open is blocked.
    router.open(init.loginURL);
    const deadline = Date.now() + 10 * 60 * 1000;
    while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        try {
            await remoteInvoke(`/forge/check_token?state=${encodeURIComponent(init.loginState)}`);
            return;
        } catch {
            // 404 until the user finishes signing in.
        }
    }
    throw new Error('Sign-in was not completed');
}

/**
 * Adds a "Sync" button to the diagram of a published page. It fetches the diagram as it is
 * now in Mermaid Chart, saves it into the page and shows it in place. It is not offered while
 * the page is being edited: Confluence's editor bridge can't update this macro there.
 * @param {{ container: HTMLElement, documentID: string, pageId: string, render: (svg: string) => void }} options
 *   `render` replaces the container's children with the new diagram.
 */
export function addSyncControl({ container, documentID, pageId, render }) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mc-sync';
    // sync.css shows data-tooltip on hover and keyboard focus.
    button.dataset.tooltip = 'Sync';
    button.setAttribute('aria-label', 'Sync');
    button.innerHTML = SYNC_ICON;

    const notice = document.createElement('p');
    notice.className = 'mc-sync-notice';
    notice.setAttribute('role', 'status');
    notice.hidden = true;
    container.after(notice);

    // render() rebuilds the container, so look the button row up each time.
    const placeButton = () => (container.querySelector('.mc-actions') ?? container).prepend(button);

    let hideTimer;
    const showNotice = (status) => {
        clearTimeout(hideTimer);
        notice.textContent = status ? syncMessage(status) : '';
        notice.classList.toggle('is-info', INFO_STATUSES.has(status));
        notice.hidden = !status;
        // Sync takes a few seconds, so say when it worked; the message then clears itself.
        if (status === 'updated') {
            hideTimer = setTimeout(() => showNotice(''), 4000);
        }
        if (status === 'signed-out') {
            const signInLink = document.createElement('button');
            signInLink.type = 'button';
            signInLink.className = 'mc-sync-signin';
            signInLink.textContent = 'Sign in';
            signInLink.addEventListener('click', async () => {
                signInLink.disabled = true;
                try {
                    await signIn();
                    await sync();
                } catch (error) {
                    console.error({ err: error.message }, 'Sign-in failed');
                    showNotice('signed-out');
                }
            });
            notice.append(signInLink);
        }
    };

    async function sync() {
        if (button.disabled) {
            return;
        }
        button.disabled = true;
        button.classList.add('is-syncing');
        showNotice('syncing');
        try {
            const result = await syncOnPage(documentID, pageId);
            if (result?.status === 'synced' && typeof result.svg === 'string') {
                render(result.svg);
                showNotice('updated');
            } else {
                showNotice(result?.status ?? 'error');
            }
        } catch (error) {
            console.error({ err: error.message }, 'Sync failed');
            showNotice('error');
        } finally {
            button.disabled = false;
            button.classList.remove('is-syncing');
            placeButton();
        }
    }

    button.addEventListener('click', () => {
        // The pointer is still over the button, so hide its label until the pointer leaves.
        button.classList.add('mc-tooltip-off');
        sync();
    });
    button.addEventListener('mouseleave', () => button.classList.remove('mc-tooltip-off'));

    placeButton();
}
