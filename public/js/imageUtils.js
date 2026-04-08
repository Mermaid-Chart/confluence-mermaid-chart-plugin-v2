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

/**
 * Strips a data: URL wrapper so detection/compression work on raw base64 or text.
 * Used when saving the macro body (Confluence expects raw base64, not a data URL).
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
      return body.replace(/\s/g, '');
    }
    try {
      const decoded = decodeURIComponent(body);
      return utf8ToBase64(decoded);
    } catch {
      return utf8ToBase64(body);
    }
  }
  const t = s.trimStart();
  if (t.startsWith('<') || t.startsWith('<?xml')) {
    return utf8ToBase64(t);
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
    return s;
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
      try {
        return atob(body);
      } catch {
        return null;
      }
    }
    try {
      return decodeURIComponent(body);
    } catch {
      return null;
    }
  }
  if (detectImageFormat(s) !== 'svg') {
    return null;
  }
  try {
    return atob(s);
  } catch {
    return null;
  }
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


