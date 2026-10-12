import { h } from 'https://esm.sh/preact';
import htm from 'https://esm.sh/htm';
import { useEffect, useRef } from 'https://esm.sh/preact/hooks';
import DOMPurify from '/vendor/dompurify/purify.es.mjs';
import { getImageDataURI, getSvgMarkupForPreview, installSvgSanitizer, sanitizeSvgRoot } from '/js/imageUtils.js?v=svg-sanitize-3';

installSvgSanitizer(DOMPurify);

const html = htm.bind(h);

function SvgInlinePreview({ svgMarkup }) {
  const ref = useRef();
  useEffect(() => {
    if (!ref.current) {
      return;
    }
    ref.current.replaceChildren();
    if (!svgMarkup) {
      return;
    }
    const doc = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml');
    if (doc.querySelector('parsererror')) {
      return;
    }
    const root = doc.documentElement;
    if (!root || String(root.localName).toLowerCase() !== 'svg') {
      return;
    }
    const safeRoot = sanitizeSvgRoot(root);
    if (!safeRoot) {
      return;
    }
    ref.current.appendChild(document.importNode(safeRoot, true));
  }, [svgMarkup]);
  return html`<div class="image svg-inline" ref=${ref} />`;
}

export function Diagram({ document, onOpenFrame, mcAccessToken }) {
  let image = '';
  if (document.documentID) {
    const svgMarkup = document.diagramImage
      ? getSvgMarkupForPreview(document.diagramImage)
      : null;
    if (svgMarkup) {
      image = html`<${SvgInlinePreview} svgMarkup=${svgMarkup} />`;
    } else if (document.diagramImage) {
      const previewUri = getImageDataURI(document.diagramImage);
      image = html`
            <div class="image">
                <img
                    src="${previewUri}"
                    alt="${document.title}"
                />
            </div>`;
    } else {
      image = html`<div class="image"></div>`;
    }
  }

  const buildUrl = (pathname) => {
    return `${MC_BASE_URL}/oauth/frame/?token=${mcAccessToken}&redirect=${pathname}`;
  };

  const onSelect = () => {
    onOpenFrame(buildUrl(`/app/plugins/confluence/select?pluginSource=confluence`));
    return false;
  };

  useEffect(() => {
    if (!document.documentID) {
      onSelect();
    }
  }, [document]);

  return html`
        <div id="diagram-container">
            <div class="diagram">
                ${image}
            </div>
           
        </div>
    `;
}
