import { view, Modal } from '@forge/bridge';
import { IMAGE_SIZES } from '../../../shared/js/constatnts.js';
import DOMPurify from '../../../shared/vendor/dompurify/purify.es.mjs';
import { installSvgSanitizer } from '../../../shared/js/imageUtils.js';
import { createDiagramFromConfig } from '../../../shared/js/diagramMount.js';
import { FULLSCREEN_MODE, renderFullscreen } from './fullscreen.js';
import { addSyncControl } from './sync.js';
import '../../../shared/css/general.css';
import './viewer.css';
import './fullscreen.css';

installSvgSanitizer(DOMPurify);

const EXPAND_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M9.5 2.5h4v4M13.5 2.5L9 7M6.5 13.5h-4v-4M2.5 13.5L7 9"/></svg>';

function resolveSizeWidth(size) {
    const key = size && IMAGE_SIZES[size] ? size : 'Medium';
    return (IMAGE_SIZES[key] || IMAGE_SIZES.Medium || IMAGE_SIZES.Small).width;
}

/**
 * Opens this same viewer resource in a pop-up modal (no extra manifest resource).
 * 'xlarge' is Forge's largest dialog size (968px x 90vh) that still shows as a pop-up over the page.
 * The rendered payload travels in the modal context; if the bridge rejects that,
 * retry without it and the modal falls back to reading the macro config.
 */
function createFullscreenOpener(payload, caption) {
    let opening = false;
    const open = (diagram) => new Modal({
        size: 'xlarge',
        closeOnEscape: true,
        closeOnOverlayClick: true,
        context: { mode: FULLSCREEN_MODE, diagram, caption },
    }).open();

    return async () => {
        if (opening) {
            return;
        }
        opening = true;
        try {
            await open(payload);
        } catch (error) {
            console.warn('Full-screen view: opening with the diagram in context failed, retrying from macro config.', error);
            try {
                await open(undefined);
            } catch (retryError) {
                console.error('Full-screen view could not be opened.', retryError);
            }
        } finally {
            opening = false;
        }
    };
}

function addFullscreenControl(actions, diagramElement, openFullscreen, isEditing) {
    const tooltip = 'Open diagram to zoom and pan';
    // In the editor a click on the diagram must keep selecting the macro, so there
    // only the expand button opens the pop-up. On the published page both do.
    if (!isEditing) {
        diagramElement.classList.add('mc-clickable');
        diagramElement.title = tooltip;
        diagramElement.addEventListener('click', (event) => {
            // Links inside the diagram (Mermaid `click` directives) keep working.
            if (event.target.closest?.('a')) {
                return;
            }
            openFullscreen();
        });
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mc-expand';
    button.title = tooltip;
    button.setAttribute('aria-label', 'Open diagram in a pop-up to zoom and pan');
    button.innerHTML = EXPAND_ICON;
    button.addEventListener('click', openFullscreen);
    actions.appendChild(button);
}

function renderMacro(config, isEditing) {
    const imageContainer = document.getElementById('image');
    if (config.caption) {
        document.getElementById('caption').innerText = config.caption;
    }
    imageContainer.style.width = `${resolveSizeWidth(config.size)}px`;
    const diagram = createDiagramFromConfig(config);
    if (!diagram) {
        return;
    }
    // The buttons sit in a row above the diagram, so they never cover it.
    const actions = document.createElement('div');
    actions.className = 'mc-actions';
    imageContainer.replaceChildren(actions, diagram.element);
    addFullscreenControl(actions, diagram.element, createFullscreenOpener(diagram.payload, config.caption), isEditing);
}

const { extension = {}, accountId } = await view.getContext();
if (extension.modal?.mode === FULLSCREEN_MODE) {
    renderFullscreen(extension);
} else {
    const config = extension.config || {};
    const isEditing = extension.isEditing === true;
    renderMacro(config, isEditing);
    // Sync updates the published page, so it is not offered while the page is being edited.
    const pageId = extension.content?.type === 'page' ? extension.content.id : undefined;
    if (accountId && config.documentID && !isEditing && pageId) {
        addSyncControl({
            container: document.getElementById('image'),
            documentID: config.documentID,
            pageId: String(pageId),
            render: (svg) => renderMacro({ ...config, diagramCode: svg }, isEditing),
        });
    }
}
