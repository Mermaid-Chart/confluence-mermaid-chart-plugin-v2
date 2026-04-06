// Configuration for size limits and compression settings
export const sizeConfig = {
  maxUncompressedSize: 1048576, // 1MB (reduced from 1.5MB)
  maxRequestSize: 4194304, // 4MB (stay under 5MB Confluence limit)
  compressionQuality: 0.8,
  compressionMaxWidth: 1000
};

/**
 * Detects if base64 string is SVG or PNG format
 * @param {string} base64String - The base64 string to check
 * @returns {string} - 'svg' or 'png'
 */
export function detectImageFormat(base64String) {
  try {
    const decoded = atob(base64String.substring(0, 100)); // Check first 100 chars
    if (decoded.includes('<svg') || decoded.includes('<?xml')) {
      return 'svg';
    }
  } catch (error) {
    // If decode fails, assume it's PNG
  }
  return 'png';
}

/**
 * Gets the appropriate data URI for an image based on its format
 * @param {string} base64String - The base64 image string
 * @param {string} format - 'svg' or 'png'
 * @returns {string} - Complete data URI
 */
export function getImageDataURI(base64String, format = null) {
  const detectedFormat = format || detectImageFormat(base64String);
  if (detectedFormat === 'svg') {
    return `data:image/svg+xml;base64,${base64String}`;
  }
  return `data:image/png;base64,${base64String}`;
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


