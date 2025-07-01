// Configuration for size limits and compression settings
export const sizeConfig = {
  maxUncompressedSize: 1572864, 
  compressionQuality: 0.8,
  compressionMaxWidth: 1000
};

/**
 * Compresses a base64 image 
 * @param {string} base64String - The base64 image string
 * @param {number} quality - Quality factor (0.1 to 1.0)
 * @param {number} maxWidth - Maximum width for resizing
 * @returns {Promise<string>} - Compressed base64 string
 */
export function compressBase64Image(base64String, quality = sizeConfig.compressionQuality, maxWidth = sizeConfig.compressionMaxWidth) {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      const timeout = setTimeout(() => {
        reject(new Error('Image compression was aborted after 10 seconds. The input image may be too large or not in a valid base64 format'));
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
      
      img.src = 'data:image/png;base64,' + base64String;
    } catch (error) {
      reject(new Error(`Image compression setup failed: ${error.message}`));
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



