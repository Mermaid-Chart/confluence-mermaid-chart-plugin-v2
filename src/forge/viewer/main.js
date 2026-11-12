import { view } from '@forge/bridge';
import { IMAGE_SIZES } from '../../../shared/js/constatnts.js';
import DOMPurify from '../../../shared/vendor/dompurify/purify.es.mjs';
import { getImageDataURI, getSvgMarkupForPreview, ensureSvgPixelDimensions, installSvgSanitizer, sanitizeSvgRoot } from '../../../shared/js/imageUtils.js';
import '../../../shared/css/general.css';
import './viewer.css';

installSvgSanitizer(DOMPurify);
const imageContainer = document.getElementById('image');

function looksLikeImagePayload(text) {
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

function resolveSizeWidth(size) {
    const key = size && IMAGE_SIZES[size] ? size : 'Medium';
    return (IMAGE_SIZES[key] || IMAGE_SIZES.Medium || IMAGE_SIZES.Small).width;
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

function showImage(payload) {
    if (!payload || !String(payload).trim()) {
        return false;
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
            imageContainer.replaceChildren(wrap);
            return true;
        }
    }

    const src = getImageDataURI(payload);
    if (!src) {
        return false;
    }
    const img = document.createElement('img');
    img.src = src;
    img.alt = 'Mermaid diagram';
    imageContainer.replaceChildren(img);
    return true;
}

function tryShow(payload) {
    return looksLikeImagePayload(payload) && showImage(payload);
}

// diagramCode is the current save location; diagramImage and the plain-text
// body (__bodyContent) are where older Connect saves put the image.
const { extension: { config = {} } } = await view.getContext();
if (config.caption) {
    document.getElementById('caption').innerText = config.caption;
}
imageContainer.style.width = `${resolveSizeWidth(config.size)}px`;
tryShow(config.diagramCode) || tryShow(config.diagramImage) || tryShow(config.__bodyContent);
