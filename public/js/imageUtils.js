// Configuration for size limits and compression settings
export const sizeConfig = {
  maxUncompressedSize: 1048576, // 1MB (reduced from 1.5MB)
  maxRequestSize: 4194304, // 4MB (stay under 5MB Confluence limit)
  compressionQuality: 0.8,
  compressionMaxWidth: 1000
};

function utf8ToBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

function utf8FromBase64(b64) {
  return decodeURIComponent(escape(atob(b64)));
}

/** Preview decode. Saved SVG is UTF-8; bare atob turns "Über" into "Ãœber". */
function decodeSvgBase64(b64) {
  try {
    return utf8FromBase64(b64);
  } catch {
    try {
      return atob(b64);
    } catch {
      return null;
    }
  }
}

const UNSAFE_SVG_TAGS = new Set(['script', 'iframe', 'object', 'embed', 'link', 'meta', 'base']);

function isDangerousSvgUrl(value) {
  if (!value) {
    return false;
  }
  const normalized = String(value).replace(/[\u0000-\u0020]+/g, '').toLowerCase();
  return (
    normalized.startsWith('javascript:') ||
    normalized.startsWith('vbscript:') ||
    (normalized.startsWith('data:') && !normalized.startsWith('data:image/'))
  );
}

/**
 * Inline SVG is live DOM, so event handlers and script tags would run in the
 * viewer iframe. Drop those and keep foreignObject (labels and FA icons).
 * @param {Element} root
 */
export function sanitizeSvgRoot(root) {
  const nodes = [root, ...root.querySelectorAll('*')];
  for (const el of nodes) {
    if (!el.isConnected && el !== root) {
      continue;
    }
    const tag = (el.localName || '').toLowerCase();
    if (UNSAFE_SVG_TAGS.has(tag)) {
      el.remove();
      continue;
    }
    const animatedAttr = el.getAttribute('attributeName');
    if (animatedAttr && /^on/i.test(animatedAttr)) {
      el.remove();
      continue;
    }
    if (
      animatedAttr &&
      /^(href|xlink:href)$/i.test(animatedAttr) &&
      (isDangerousSvgUrl(el.getAttribute('to')) || isDangerousSvgUrl(el.getAttribute('values')))
    ) {
      el.remove();
      continue;
    }
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      const local = (attr.localName || attr.name).toLowerCase();
      if (name.startsWith('on') || local.startsWith('on')) {
        el.removeAttribute(attr.name);
        continue;
      }
      if ((local === 'href' || local === 'src' || name === 'xlink:href') && isDangerousSvgUrl(attr.value)) {
        el.removeAttribute(attr.name);
      }
    }
  }
}

/**
 * @param {string} svgMarkup
 * @returns {string|null}
 */
export function sanitizeSvgMarkup(svgMarkup) {
  if (!svgMarkup || typeof svgMarkup !== 'string' || typeof DOMParser === 'undefined') {
    return svgMarkup;
  }
  try {
    const doc = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml');
    if (doc.querySelector('parsererror')) {
      return null;
    }
    const root = doc.documentElement;
    if (!root || root.localName.toLowerCase() !== 'svg') {
      return null;
    }
    sanitizeSvgRoot(root);
    return new XMLSerializer().serializeToString(root);
  } catch {
    return null;
  }
}

/** Decode SVG base64, bake pixel dimensions, re-encode. Falls back to raw on failure. */
function normalizeSvgBase64(rawBase64) {
  const raw = rawBase64.replace(/\s/g, '');
  try {
    return utf8ToBase64(ensureSvgPixelDimensions(utf8FromBase64(raw)));
  } catch {
    return raw;
  }
}

/** Pixel size for Mermaid `.label-icon` nested SVGs (`1em` is unreliable in Confluence iframes). */
const LABEL_ICON_PX = 14;

/**
 * Replace width/height="…em" on nested <svg> (not the root) with fixed px.
 * FA icons like fa:fa-car embed as nested label-icon SVGs with 1em size.
 * @param {string} svgMarkup
 * @returns {string}
 */
function normalizeNestedSvgEmUnits(svgMarkup) {
  let first = true;
  return svgMarkup.replace(/<svg\b[^>]*>/gi, (tag) => {
    if (first) {
      first = false;
      return tag;
    }
    return tag
      .replace(/\bwidth\s*=\s*["'][^"']*em["']/i, `width="${LABEL_ICON_PX}"`)
      .replace(/\bheight\s*=\s*["'][^"']*em["']/i, `height="${LABEL_ICON_PX}"`);
  });
}

/**
 * Mermaid embeds `#export-svg .label-icon{height:1em}` which overrides SVG attributes.
 * Bake to px so icons keep a stable size outside the editor stylesheet.
 * @param {string} svgMarkup
 * @returns {string}
 */
function normalizeLabelIconCss(svgMarkup) {
  return svgMarkup.replace(/\.label-icon\s*\{[^}]*\}/gi, (block) =>
    block.replace(/(height|width)\s*:\s*[^;}\s]+em\b/gi, `$1:${LABEL_ICON_PX}px`),
  );
}

/** Inner markup of the div that starts at `contentStart`, honoring nested divs. */
function divInnerContent(markup, contentStart) {
  let depth = 1;
  let index = contentStart;
  const lower = markup.toLowerCase();
  while (index < markup.length && depth > 0) {
    const nextOpen = lower.indexOf('<div', index);
    const nextClose = lower.indexOf('</div', index);
    if (nextClose === -1) {
      return markup.slice(contentStart);
    }
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      index = nextOpen + 4;
      continue;
    }
    depth -= 1;
    if (depth === 0) {
      return markup.slice(contentStart, nextClose);
    }
    index = nextClose + 6;
  }
  return markup.slice(contentStart);
}

/**
 * FA icons use height:1em. Only the label that contains a .label-icon gets a
 * fixed font-size, so other labels keep the diagram stylesheet / theme size.
 * @param {string} svgMarkup
 * @returns {string}
 */
function ensureForeignObjectLabelFontSize(svgMarkup) {
  // Repair already-saved markup from a missing semicolon: "14pxdisplay" → "14px;display"
  const repaired = svgMarkup.replace(/font-size:\s*(\d+)px(?=[a-zA-Z])/gi, 'font-size: $1px;');
  return repaired.replace(
    /(<div\b[^>]*\bxmlns=["']http:\/\/www\.w3\.org\/1999\/xhtml["'][^>]*\bstyle=["'])([^"']*)(["'])/gi,
    (full, open, style, close, offset, whole) => {
      const content = divInnerContent(whole, offset + full.length);
      const hasIcon = /label-icon/i.test(content);
      if (/\bfont-size\s*:/i.test(style)) {
        if (!hasIcon && /^font-size:\s*14px;?\s*/i.test(style)) {
          return `${open}${style.replace(/^font-size:\s*14px;?\s*/i, '')}${close}`;
        }
        return full;
      }
      if (!hasIcon) {
        return full;
      }
      const prefix = style.trim() ? `font-size: ${LABEL_ICON_PX}px;` : `font-size: ${LABEL_ICON_PX}px`;
      return `${open}${prefix}${style}${close}`;
    },
  );
}

/**
 * Mermaid SVGs often use width/height="100%". As an <img> data-URI those have no
 * intrinsic size and render blank on the Confluence page. Replace % sizes with
 * viewBox pixel dimensions when possible. Also bake FA label-icon em units to px.
 * @param {string} svgMarkup
 * @returns {string}
 */
export function ensureSvgPixelDimensions(svgMarkup) {
  if (!svgMarkup || typeof svgMarkup !== 'string') {
    return svgMarkup;
  }
  if (!/<svg[\s>/]/i.test(svgMarkup)) {
    return svgMarkup;
  }

  const rootOpenMatch = svgMarkup.match(/<svg\b[^>]*>/i);
  const rootTag = rootOpenMatch ? rootOpenMatch[0] : '';
  const viewBoxMatch = rootTag.match(/\bviewBox\s*=\s*["']([^"']+)["']/i)
    || svgMarkup.match(/\bviewBox\s*=\s*["']([^"']+)["']/i);
  if (!viewBoxMatch) {
    return normalizeLabelIconCss(
      ensureForeignObjectLabelFontSize(normalizeNestedSvgEmUnits(svgMarkup)),
    );
  }
  const parts = viewBoxMatch[1].trim().split(/[\s,]+/).map(Number);
  if (parts.length < 4 || !(parts[2] > 0) || !(parts[3] > 0)) {
    return normalizeLabelIconCss(
      ensureForeignObjectLabelFontSize(normalizeNestedSvgEmUnits(svgMarkup)),
    );
  }
  const pixelWidth = String(parts[2]);
  const pixelHeight = String(parts[3]);

  // Inspect only the root <svg> tag — foreignObject / nested icons also have width/height.
  const widthIsPercent = /\bwidth\s*=\s*["'][^"']*%["']/i.test(rootTag);
  const heightIsPercent = /\bheight\s*=\s*["'][^"']*%["']/i.test(rootTag);
  const missingWidth = !/\bwidth\s*=\s*["']/i.test(rootTag);
  const missingHeight = !/\bheight\s*=\s*["']/i.test(rootTag);

  let out = svgMarkup;
  if (widthIsPercent) {
    out = out.replace(/<svg\b[^>]*>/i, (tag) =>
      tag.replace(/\bwidth\s*=\s*["'][^"']*%["']/i, `width="${pixelWidth}"`),
    );
  } else if (missingWidth) {
    out = out.replace(/<svg\b/i, `<svg width="${pixelWidth}"`);
  }
  if (heightIsPercent) {
    out = out.replace(/<svg\b[^>]*>/i, (tag) =>
      tag.replace(/\bheight\s*=\s*["'][^"']*%["']/i, `height="${pixelHeight}"`),
    );
  } else if (missingHeight) {
    out = out.replace(/<svg\b/i, `<svg height="${pixelHeight}"`);
  }

  out = normalizeNestedSvgEmUnits(out);
  out = ensureForeignObjectLabelFontSize(out);
  out = normalizeLabelIconCss(out);
  return out;
}

/**
 * Strips a data: URL wrapper so detection/compression work on raw base64 or text.
 * Used when saving the macro body (Confluence expects raw base64, not a data URL).
 * Also normalizes SVG % dimensions so page <img> rendering is not blank.
 * @param {string} diagramImage
 * @returns {string}
 */
export function extractBase64ForMacroBody(diagramImage) {
  if (diagramImage == null || diagramImage === '') {
    return diagramImage;
  }
  if (typeof diagramImage !== 'string') {
    return diagramImage;
  }
  const s = diagramImage.trim();
  if (s.startsWith('data:')) {
    const comma = s.indexOf(',');
    if (comma === -1) {
      return diagramImage;
    }
    const header = s.slice(0, comma).toLowerCase();
    const body = s.slice(comma + 1);
    if (header.includes('base64')) {
      const raw = body.replace(/\s/g, '');
      return header.includes('svg') ? normalizeSvgBase64(raw) : raw;
    }
    try {
      const decoded = decodeURIComponent(body);
      const normalized = header.includes('svg')
        ? ensureSvgPixelDimensions(decoded)
        : decoded;
      return utf8ToBase64(normalized);
    } catch {
      return utf8ToBase64(body);
    }
  }
  const t = s.trimStart();
  if (t.startsWith('<') || t.startsWith('<?xml')) {
    return utf8ToBase64(ensureSvgPixelDimensions(t));
  }
  // Raw base64 — if SVG, bake pixel dimensions
  if (detectImageFormat(s) === 'svg') {
    return normalizeSvgBase64(s);
  }
  return s.replace(/\s/g, '');
}

/**
 * Detects if base64 string is SVG or PNG format
 * @param {string} base64String - The base64 string to check
 * @returns {string} - 'svg' or 'png'
 */
export function detectImageFormat(base64String) {
  if (!base64String || typeof base64String !== 'string') {
    return 'png';
  }
  try {
    const len = base64String.length;
    if (len < 8) {
      return 'png';
    }
    // Decode a large enough prefix: SVG often has <?xml, comments, or whitespace before <svg>
    const maxB64 = Math.min(len, 32768);
    const aligned = maxB64 - (maxB64 % 4);
    const decoded = atob(base64String.substring(0, aligned));

    // PNG starts with magic bytes (binary); never treat as SVG
    if (
      decoded.length >= 4 &&
      decoded.charCodeAt(0) === 0x89 &&
      decoded.slice(1, 4) === 'PNG'
    ) {
      return 'png';
    }

    const lower = decoded.toLowerCase();
    if (
      lower.includes('<svg') ||
      decoded.includes('<?xml') ||
      lower.includes('<!doctype svg')
    ) {
      return 'svg';
    }
  } catch (error) {
    // If decode fails, assume it's PNG
  }
  return 'png';
}

/**
 * Gets the appropriate data URI for an image based on its format
 * @param {string} input - Raw base64, full data: URL, or raw SVG markup
 * @param {string} format - optional 'svg' or 'png'
 * @returns {string} - Complete data URI for <img src>
 */
export function getImageDataURI(input, format = null) {
  if (input == null || input === '') {
    return '';
  }
  const s = typeof input === 'string' ? input : String(input);

  
  if (s.startsWith('data:')) {
    return s;
  }

  const trimmed = s.trimStart();
  if (trimmed.startsWith('<') || trimmed.startsWith('<?xml')) {
    if (/<svg[\s>/]/i.test(trimmed) || trimmed.includes('<svg')) {
      const uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(trimmed)}`;
      return uri;
    }
  }

  const detectedFormat = format || detectImageFormat(s);
  if (detectedFormat === 'svg') {
    return `data:image/svg+xml;base64,${s}`;
  }
  return `data:image/png;base64,${s}`;
}

/**
 * Decodes SVG markup for inline DOM preview.
 * Root SVG with width="100%" / height="100%" has no intrinsic size in img elements, so it renders invisible;
 * inlining avoids that. Returns null for PNG or invalid input.
 * @param {string} input
 * @returns {string|null}
 */
export function getSvgMarkupForPreview(input) {
  if (input == null || input === '') {
    return null;
  }
  if (typeof input !== 'string') {
    return null;
  }
  const s = input.trim();
  if (s.startsWith('<') && /<svg[\s>/]/i.test(s)) {
    return sanitizeSvgMarkup(s);
  }
  if (s.startsWith('data:')) {
    const comma = s.indexOf(',');
    if (comma === -1) {
      return null;
    }
    const header = s.slice(0, comma).toLowerCase();
    const body = s.slice(comma + 1);
    if (!header.includes('svg')) {
      return null;
    }
    if (header.includes('base64')) {
      const decoded = decodeSvgBase64(body);
      return decoded ? sanitizeSvgMarkup(decoded) : null;
    }
    try {
      return sanitizeSvgMarkup(decodeURIComponent(body));
    } catch {
      return null;
    }
  }
  if (detectImageFormat(s) !== 'svg') {
    return null;
  }
  const decoded = decodeSvgBase64(s);
  return decoded ? sanitizeSvgMarkup(decoded) : null;
}

/**
 * Rasterize SVG (base64 / data URI / markup) to PNG base64 for reliable Confluence <img> display.
 * Bakes viewBox pixel sizes first so width/height 100% SVGs are not drawn at 0×0.
 * @param {string} svgInput
 * @returns {Promise<string|null>} PNG base64 without data: prefix, or null on failure
 */
export function rasterizeSvgToPngBase64(svgInput) {
  return new Promise((resolve) => {
    try {
      let markup = getSvgMarkupForPreview(svgInput);
      if (!markup) {
        resolve(null);
        return;
      }
      markup = ensureSvgPixelDimensions(markup);
      const vbMatch = markup.match(/\bviewBox\s*=\s*["']([^"']+)["']/i);
      let width = 800;
      let height = 600;
      if (vbMatch) {
        const parts = vbMatch[1].trim().split(/[\s,]+/).map(Number);
        if (parts.length >= 4 && parts[2] > 0 && parts[3] > 0) {
          width = Math.ceil(parts[2]);
          height = Math.ceil(parts[3]);
        }
      }
      const wMatch = markup.match(/\bwidth\s*=\s*["']([0-9.]+)/i);
      const hMatch = markup.match(/\bheight\s*=\s*["']([0-9.]+)/i);
      if (wMatch) width = Math.ceil(Number(wMatch[1])) || width;
      if (hMatch) height = Math.ceil(Number(hMatch[1])) || height;

      const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      const timeout = setTimeout(() => {
        URL.revokeObjectURL(url);
        resolve(null);
      }, 15000);

      img.onload = () => {
        clearTimeout(timeout);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/png');
          URL.revokeObjectURL(url);
          resolve(dataUrl.split(',')[1] || null);
        } catch {
          URL.revokeObjectURL(url);
          resolve(null);
        }
      };
      img.onerror = () => {
        clearTimeout(timeout);
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    } catch {
      resolve(null);
    }
  });
}

/**
 * Compresses a base64 image (SVG or PNG)
 * @param {string} base64String - The base64 image string
 * @param {number} quality - Quality factor (0.1 to 1.0)
 * @param {number} maxWidth - Maximum width for resizing
 * @returns {Promise<string>} - Compressed base64 string
 */
export function compressBase64Image(base64String, quality = sizeConfig.compressionQuality, maxWidth = sizeConfig.compressionMaxWidth) {
  return new Promise((resolve, reject) => {
    try {
      const format = detectImageFormat(base64String);
      
      if (format === 'svg') {
        // SVG compression - minify the SVG content
        const svgContent = atob(base64String);
        const minifiedSvg = svgContent
          .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
          .replace(/>\s+</g, '><')  // Remove spaces between tags
          .replace(/\s+>/g, '>')   // Remove spaces before closing brackets
          .replace(/<\s+/g, '<')   // Remove spaces after opening brackets
          .trim();
        const compressedBase64 = btoa(minifiedSvg);
        resolve(compressedBase64);
      } else {
        // PNG compression - use canvas method
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        const timeout = setTimeout(() => {
          reject(new Error('Image compression was aborted after 10 seconds'));
        }, 10000);
        
        img.onload = function() {
          clearTimeout(timeout);
          try {
            let { width, height } = img;
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            ctx.drawImage(img, 0, 0, width, height);
            const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
            const base64Data = compressedBase64.split(',')[1];
            resolve(base64Data);
          } catch (error) {
            reject(new Error(`Canvas compression failed: ${error.message}`));
          }
        };
        
        img.onerror = function() {
          clearTimeout(timeout);
          reject(new Error('Failed to load image for compression'));
        };
        
        img.src = `data:image/png;base64,${base64String}`;
      }
    } catch (error) {
      // If compression fails, return original
      console.warn('Image compression failed, using original:', error.message);
      resolve(base64String);
    }
  });
}

/**
 * Calculate the size of data in bytes
 * @param {string|object} data - The data to calculate size for
 * @returns {number} Size in bytes
 */
export const calculateDataSize = (data) => {
  return new TextEncoder().encode(
    typeof data === 'string' ? data : JSON.stringify(data)
  ).length;
};

/**
 * Aggressive SVG compression with multiple strategies
 * @param {string} svgContent - The SVG content to compress
 * @param {boolean} aggressive - Use aggressive compression mode
 * @returns {string} Compressed SVG content
 */
export function compressSvgContent(svgContent, aggressive = false) {
  let compressed = svgContent;
  
  // Basic compression
  compressed = compressed
    .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/>\s+</g, '><') // Remove spaces between tags
    .replace(/\s+>/g, '>') // Remove spaces before closing brackets
    .replace(/<\s+/g, '<') // Remove spaces after opening brackets
    .replace(/=""/g, '') // Remove empty attributes
    .trim();
  
  if (aggressive) {
    // More aggressive compression
    compressed = compressed
      .replace(/id="[^"]*"/g, '') // Remove IDs
      .replace(/class="[^"]*"/g, '') // Remove classes
      .replace(/\s*;\s*/g, ';') // Clean up style separators
      .replace(/:\s+/g, ':') // Remove spaces in CSS
      .replace(/;\s*}/g, '}') // Clean up CSS endings
      .replace(/\s*{\s*/g, '{') // Clean up CSS beginnings
      .replace(/\s*,\s*/g, ',') // Clean up commas
      .replace(/\n/g, '') // Remove newlines
      .replace(/\t/g, ''); // Remove tabs
  }
  
  return compressed;
}

/**
 * Progressive compression function for Confluence 5MB limit
 * Tries multiple compression strategies until size is acceptable
 * @param {string} base64String - The base64 image string
 * @param {string} format - Image format ('svg' or 'png')
 * @returns {Promise<string>} - Compressed base64 string
 */
export async function compressForConfluence(base64String, format = null) {
  const detectedFormat = format || detectImageFormat(base64String);
  
  // Compression levels to try progressively
  const compressionLevels = [
    { quality: 0.8, maxWidth: 1000, aggressive: false },
    { quality: 0.6, maxWidth: 800, aggressive: false },
    { quality: 0.4, maxWidth: 600, aggressive: true },
    { quality: 0.2, maxWidth: 400, aggressive: true }
  ];
  
  let compressed = base64String;
  let currentSize = calculateDataSize(compressed);
  
  // If already small enough, return as-is
  if (currentSize <= sizeConfig.maxRequestSize) {
    return compressed;
  }
  
  for (let i = 0; i < compressionLevels.length; i++) {
    const level = compressionLevels[i];
    
    try {
      if (detectedFormat === 'svg') {
        // SVG compression
        const svgContent = atob(compressed);
        const compressedSvg = compressSvgContent(svgContent, level.aggressive);
        compressed = btoa(compressedSvg);
      } else {
        // PNG compression with canvas
        compressed = await compressBase64Image(compressed, level.quality, level.maxWidth);
      }
      
      currentSize = calculateDataSize(compressed);
      // Check if we're now under the limit
      if (currentSize <= sizeConfig.maxRequestSize) {
        return compressed;
      }
    } catch (error) {
      console.warn(`Compression level ${i + 1} failed:`, error.message);
      continue;
    }
  }
  
  // If all compression levels failed, return best attempt
  console.warn(`⚠️  Could not compress below ${(sizeConfig.maxRequestSize / 1024).toFixed(2)}KB limit. Final size: ${(currentSize / 1024).toFixed(2)}KB`);
  return compressed;
}


