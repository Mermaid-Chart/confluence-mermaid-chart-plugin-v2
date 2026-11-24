import { view } from '@forge/bridge';
import { createDiagramElement, createDiagramFromConfig } from '../../../shared/js/diagramMount.js';

/** Modal context flag: the viewer resource opened by Modal() renders this view instead of the macro. */
export const FULLSCREEN_MODE = 'mermaid-fullscreen';

const STEP = 1.25;
const MAX_SCALE = 8;
const FIT_PADDING = 24;
const PAN_KEY_STEP = 60;

const ICONS = {
    minus: '<path d="M3.5 8h9"/>',
    plus: '<path d="M8 3.5v9M3.5 8h9"/>',
    fit: '<path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"/>',
    close: '<path d="M4 4l8 8M12 4l-8 8"/>',
};

function icon(name) {
    return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`;
}

function button({ label, title, html, className = '' }) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `mc-fs-btn ${className}`.trim();
    b.setAttribute('aria-label', label);
    b.title = title;
    b.innerHTML = html;
    return b;
}

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) {
        node.className = className;
    }
    if (text) {
        node.textContent = text;
    }
    return node;
}

/** Natural (100%) size of the mounted diagram in CSS px. */
function naturalSize(diagram) {
    if (diagram.svg) {
        const vb = diagram.svg.viewBox?.baseVal;
        if (vb && vb.width > 0 && vb.height > 0) {
            return { width: vb.width, height: vb.height };
        }
        const w = parseFloat(diagram.svg.getAttribute('width'));
        const h = parseFloat(diagram.svg.getAttribute('height'));
        if (w > 0 && h > 0) {
            return { width: w, height: h };
        }
        const box = diagram.svg.getBoundingClientRect();
        return { width: box.width || 800, height: box.height || 600 };
    }
    return { width: diagram.img.naturalWidth || 800, height: diagram.img.naturalHeight || 600 };
}

/**
 * Zoom = resize the SVG element itself (width/height in px), so the browser re-renders
 * the vectors at the real size and they stay crisp. Pan = translate() on the stage only.
 * A CSS scale() would let Chrome reuse a rasterized layer and blur it mid-zoom.
 */
function createZoomController({ viewport, stage, diagram, readout }) {
    const target = diagram.svg || diagram.img;
    const natural = naturalSize(diagram);
    const state = { scale: 1, x: 0, y: 0, fitMode: true };
    let frame = 0;

    // The page viewer styles the SVG as width:100%/height:auto, and Mermaid adds an
    // inline max-width. Here the element must be free to grow past its natural size.
    target.style.maxWidth = 'none';
    target.style.maxHeight = 'none';

    function fitScale() {
        const w = viewport.clientWidth - FIT_PADDING * 2;
        const h = viewport.clientHeight - FIT_PADDING * 2;
        return Math.max(Math.min(w / natural.width, h / natural.height), 0.01);
    }

    function limits() {
        const fit = fitScale();
        return { min: Math.min(0.1, fit / 2), max: Math.max(MAX_SCALE, fit) };
    }

    function render() {
        frame = 0;
        target.style.width = `${natural.width * state.scale}px`;
        target.style.height = `${natural.height * state.scale}px`;
        stage.style.transform = `translate(${state.x}px, ${state.y}px)`;
        readout.textContent = `${Math.round(state.scale * 100)}%`;
    }

    function schedule() {
        if (!frame) {
            frame = requestAnimationFrame(render);
        }
    }

    function center() {
        return { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 };
    }

    /** Zoom to `next`, keeping the diagram point under (cx, cy) fixed on screen. */
    function zoomTo(next, cx, cy) {
        const { min, max } = limits();
        const scale = Math.min(max, Math.max(min, next));
        const px = (cx - state.x) / state.scale;
        const py = (cy - state.y) / state.scale;
        state.x = cx - px * scale;
        state.y = cy - py * scale;
        state.scale = scale;
        state.fitMode = false;
        schedule();
    }

    function zoomBy(factor, point = center()) {
        zoomTo(state.scale * factor, point.x, point.y);
    }

    function fit() {
        const { min, max } = limits();
        const scale = Math.min(max, Math.max(min, fitScale()));
        state.scale = scale;
        state.x = (viewport.clientWidth - natural.width * scale) / 2;
        state.y = (viewport.clientHeight - natural.height * scale) / 2;
        state.fitMode = true;
        schedule();
    }

    function reset() {
        const c = center();
        zoomTo(1, c.x, c.y);
    }

    function panBy(dx, dy) {
        state.x += dx;
        state.y += dy;
        state.fitMode = false;
        schedule();
    }

    function onResize() {
        if (state.fitMode) {
            fit();
        }
    }

    return { zoomBy, zoomTo, fit, reset, panBy, onResize };
}

function bindPointerAndWheel(viewport, zoom) {
    viewport.addEventListener('wheel', (event) => {
        event.preventDefault();
        const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1;
        // Clamp so one notch of a coarse mouse wheel does not jump several steps.
        const delta = Math.max(-120, Math.min(120, event.deltaY * unit));
        // ctrlKey is set for trackpad pinch, which sends small deltas: scale them up.
        const factor = Math.exp(-delta * (event.ctrlKey ? 0.01 : 0.002));
        const rect = viewport.getBoundingClientRect();
        zoom.zoomBy(factor, { x: event.clientX - rect.left, y: event.clientY - rect.top });
    }, { passive: false });

    let drag = null;
    viewport.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) {
            return;
        }
        drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
        viewport.setPointerCapture(event.pointerId);
        viewport.classList.add('is-panning');
        event.preventDefault();
        viewport.focus({ preventScroll: true });
    });
    viewport.addEventListener('pointermove', (event) => {
        if (!drag || event.pointerId !== drag.id) {
            return;
        }
        zoom.panBy(event.clientX - drag.x, event.clientY - drag.y);
        drag.x = event.clientX;
        drag.y = event.clientY;
    });
    const endDrag = (event) => {
        if (drag && event.pointerId === drag.id) {
            drag = null;
            viewport.classList.remove('is-panning');
        }
    };
    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);
}

function bindKeys(zoom, close) {
    document.addEventListener('keydown', (event) => {
        if (event.ctrlKey || event.metaKey || event.altKey) {
            return;
        }
        const actions = {
            '+': () => zoom.zoomBy(STEP),
            '=': () => zoom.zoomBy(STEP),
            '-': () => zoom.zoomBy(1 / STEP),
            _: () => zoom.zoomBy(1 / STEP),
            0: () => zoom.reset(),
            ArrowLeft: () => zoom.panBy(PAN_KEY_STEP, 0),
            ArrowRight: () => zoom.panBy(-PAN_KEY_STEP, 0),
            ArrowUp: () => zoom.panBy(0, PAN_KEY_STEP),
            ArrowDown: () => zoom.panBy(0, -PAN_KEY_STEP),
            Escape: close,
        };
        const action = actions[event.key];
        if (action) {
            event.preventDefault();
            action();
        }
    });
}

/** Build the page shown inside the zoom pop-up (modal). */
export function renderFullscreen(extension) {
    document.documentElement.classList.add('mc-fs');
    const { modal = {}, config = {} } = extension;
    const close = () => view.close().catch(() => {});

    const root = el('div', 'mc-fs-root');
    const toolbar = el('div', 'mc-fs-toolbar');
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-label', 'Diagram view controls');
    const title = el('div', 'mc-fs-title', modal.caption || config.caption || 'Mermaid diagram');
    const controls = el('div', 'mc-fs-controls');
    const zoomOut = button({ label: 'Zoom out', title: 'Zoom out (−)', html: icon('minus') });
    const readout = el('span', 'mc-fs-zoom', '100%');
    readout.setAttribute('aria-live', 'polite');
    readout.title = 'Current zoom';
    const zoomIn = button({ label: 'Zoom in', title: 'Zoom in (+)', html: icon('plus') });
    const fitBtn = button({ label: 'Fit to screen', title: 'Fit to screen', html: `${icon('fit')}<span>Fit</span>` });
    const closeBtn = button({ label: 'Close', title: 'Close (Esc)', html: icon('close'), className: 'mc-fs-close' });
    controls.append(zoomOut, readout, zoomIn, el('span', 'mc-fs-sep'), fitBtn, el('span', 'mc-fs-sep'), closeBtn);
    toolbar.append(title, controls);

    const viewport = el('div', 'mc-fs-viewport');
    viewport.tabIndex = 0;
    viewport.setAttribute('aria-label', 'Diagram. Drag to pan, scroll to zoom.');
    const stage = el('div', 'mc-fs-stage');
    viewport.appendChild(stage);
    root.append(toolbar, viewport);
    document.body.replaceChildren(root);
    closeBtn.addEventListener('click', close);

    // Prefer the payload the page view already rendered; macro config is the fallback.
    const diagram = createDiagramElement(modal.diagram) || createDiagramFromConfig(config);
    if (!diagram) {
        [zoomOut, zoomIn, fitBtn].forEach((b) => { b.disabled = true; });
        viewport.appendChild(el('p', 'mc-fs-error', 'The diagram could not be loaded.'));
        bindKeys({ zoomBy() {}, reset() {}, panBy() {} }, close);
        closeBtn.focus();
        return;
    }
    stage.appendChild(diagram.element);

    const start = () => {
        const zoom = createZoomController({ viewport, stage, diagram, readout });
        zoomIn.addEventListener('click', () => zoom.zoomBy(STEP));
        zoomOut.addEventListener('click', () => zoom.zoomBy(1 / STEP));
        fitBtn.addEventListener('click', () => zoom.fit());
        bindPointerAndWheel(viewport, zoom);
        bindKeys(zoom, close);
        window.addEventListener('resize', () => zoom.onResize());
        zoom.fit();
        viewport.focus({ preventScroll: true });
    };

    if (diagram.img && !diagram.img.complete) {
        diagram.img.addEventListener('load', start, { once: true });
    } else {
        start();
    }
}
