import { remoteInvoke } from '../editor/remote.js';
import './sync.css';

const SYNC_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M13.5 8a5.5 5.5 0 0 1-9.4 3.9M2.5 8a5.5 5.5 0 0 1 9.4-3.9M12.5 1.5v2.6H9.9M3.5 14.5v-2.6h2.6"/></svg>';

const EDIT = 'Edit this page and open the diagram';

/** One-line explanation when the diagram can't be synced. */
function syncMessage(status) {
    const messages = {
        deleted: `This diagram was deleted from Mermaid Chart. ${EDIT} to import the copy saved on this page.`,
        'no-access': `This diagram is in a Mermaid Chart account you can't open. ${EDIT} to ask the owner for access.`,
        unavailable: `This diagram couldn't be loaded from your Mermaid Chart account. ${EDIT} to see why.`,
        'signed-out': `Sign in to Mermaid Chart to sync this diagram. ${EDIT} to sign in.`,
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

    const showNotice = (text) => {
        notice.textContent = text;
        notice.hidden = !text;
    };

    button.addEventListener('click', async () => {
        if (button.disabled) {
            return;
        }
        button.disabled = true;
        button.classList.add('is-syncing');
        showNotice('');
        try {
            const result = await syncOnPage(documentID, pageId);
            if (result?.status === 'synced' && typeof result.svg === 'string') {
                render(result.svg);
            } else {
                showNotice(syncMessage(result?.status));
            }
        } catch (error) {
            console.error({ err: error.message }, 'Sync failed');
            showNotice(syncMessage('error'));
        } finally {
            button.disabled = false;
            button.classList.remove('is-syncing');
            // render() replaces the container's children, so put the button back.
            container.appendChild(button);
        }
    });

    container.appendChild(button);
}
