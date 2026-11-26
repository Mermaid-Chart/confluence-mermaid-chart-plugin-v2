import { getImageDataURI, getSvgMarkupForPreview, ensureSvgPixelDimensions, sanitizeSvgRoot } from './imageUtils.js';

/**
 * Decode + sanitize + mount steps shared by the page viewer and the full-screen modal.
 * installSvgSanitizer(DOMPurify) must have been called before any of these run.
 */

export function looksLikeImagePayload(text) {
    if (!text || typeof text !== 'string') {
        return false;
    }
    const t = text.trim();
    if (t.startsWith('data:image') || t.startsWith('PHN2Zy') || t.startsWith('iVBOR') || t.startsWith('<svg')) {
        return true;
    }
    if (t.length > 200 && !/^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram)/i.test(t)) {
        return /^[A-Za-z0-9+/=\s]+$/.test(t.slice(0, 80));
    }
    return false;
}

/**
 * Mount SVG via image/svg+xml parser — HTML innerHTML mangles foreignObject
 * + nested label-icon SVGs (FA icons like fa:fa-car).
 */
function mountInlineSvg(svgMarkup) {
    const doc = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml');
    if (doc.querySelector('parsererror')) {
        return null;
    }
    const root = doc.documentElement;
    if (!root || root.localName.toLowerCase() !== 'svg') {
        return null;
    }
    const safeRoot = sanitizeSvgRoot(root);
    if (!safeRoot) {
        return null;
    }
    return document.importNode(safeRoot, true);
}

/**
 * Build the diagram node for one payload.
 * @param {string} payload base64 SVG/PNG, data: URL or SVG markup
 * @returns {{ element: HTMLElement, svg: SVGSVGElement|null, img: HTMLImageElement|null } | null}
 *   element is the node to insert (a .svg-inline wrapper or an <img>).
 */
export function createDiagramElement(payload) {
    if (!looksLikeImagePayload(payload)) {
        return null;
    }

    // Prefer inline SVG with pixel dimensions from viewBox — <img> + width=100%
    // SVGs collapse to blank boxes inside Confluence iframes.
    let svgMarkup = getSvgMarkupForPreview(payload);
    if (svgMarkup) {
        svgMarkup = ensureSvgPixelDimensions(svgMarkup);
        const svg = mountInlineSvg(svgMarkup);
        if (svg) {
            const vb = svg.viewBox?.baseVal;
            if (vb && vb.width > 0 && vb.height > 0) {
                svg.setAttribute('width', String(vb.width));
                svg.setAttribute('height', String(vb.height));
            }
            svg.style.width = '100%';
            svg.style.height = 'auto';
            svg.setAttribute(
                'preserveAspectRatio',
                svg.getAttribute('preserveAspectRatio') || 'xMidYMid meet',
            );
            const wrap = document.createElement('div');
            wrap.className = 'svg-inline';
            wrap.appendChild(svg);
            return { element: wrap, svg, img: null };
        }
    }

    const src = getImageDataURI(payload);
    if (!src) {
        return null;
    }
    const img = document.createElement('img');
    img.src = src;
    img.alt = 'Mermaid diagram';
    return { element: img, svg: null, img };
}

/**
 * First saved location that renders. diagramCode is the current save location;
 * diagramImage and the plain-text body (__bodyContent) are where older Connect saves put the image.
 * @returns {{ payload: string, element: HTMLElement, svg: SVGSVGElement|null, img: HTMLImageElement|null } | null}
 */
export function createDiagramFromConfig(config = {}) {
    for (const payload of [config.diagramCode, config.diagramImage, config.__bodyContent]) {
        const result = createDiagramElement(payload);
        if (result) {
            return { payload, ...result };
        }
    }
    return null;
}
