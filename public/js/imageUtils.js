// Utility functions for image processing

/**
 * Compresses a base64 image by reducing quality
 * @param {string} base64String - The base64 image string
 * @param {number} quality - Quality factor (0.1 to 1.0)
 * @param {number} maxWidth - Maximum width for resizing
 * @returns {Promise<string>} - Compressed base64 string
 */
export function compressBase64Image(base64String, quality = 0.8, maxWidth = 1200) {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      const timeout = setTimeout(() => {
        reject(new Error('Image compression timeout'));
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


