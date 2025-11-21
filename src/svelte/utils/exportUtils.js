import { toBase64 } from 'js-base64';

const getSvgEl = async (renderResult, backgroundColor = '#ffffff') => {
  if (!renderResult || !renderResult.svg) {
    throw new Error('Invalid render result');
  }

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = renderResult.svg;
  
  const svgElement = tempDiv.querySelector('svg');
  if (!svgElement) {
    throw new Error('No SVG element found in render result');
  }

  const clonedSvg = svgElement.cloneNode(true);

  if (!clonedSvg.hasAttribute('xmlns')) {
    clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }

  if (!clonedSvg.hasAttribute('xmlns:xlink')) {
    clonedSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  }

  const scripts = clonedSvg.querySelectorAll('script');
  scripts.forEach(script => script.remove());

  if (backgroundColor && backgroundColor !== 'transparent') {
    const backgroundRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    backgroundRect.setAttribute('width', '100%');
    backgroundRect.setAttribute('height', '100%');
    backgroundRect.setAttribute('fill', backgroundColor);
    clonedSvg.insertBefore(backgroundRect, clonedSvg.firstChild);
  }
  
  return clonedSvg;
};

const getSvgDimensions = (svgElement) => {
  let width = 800;
  let height = 600;
  
  try {
    if (svgElement.width && svgElement.width.baseVal && svgElement.width.baseVal.unitType === SVGLength.SVG_LENGTHTYPE_NUMBER) {
      width = svgElement.width.baseVal.value;
    } else if (svgElement.getAttribute('width')) {
      const widthAttr = svgElement.getAttribute('width');
      const widthNum = parseFloat(widthAttr);
      if (!isNaN(widthNum) && !widthAttr.includes('%')) {
        width = widthNum;
      }
    }
    
    if (svgElement.height && svgElement.height.baseVal && svgElement.height.baseVal.unitType === SVGLength.SVG_LENGTHTYPE_NUMBER) {
      height = svgElement.height.baseVal.value;
    } else if (svgElement.getAttribute('height')) {
      const heightAttr = svgElement.getAttribute('height');
      const heightNum = parseFloat(heightAttr);
      if (!isNaN(heightNum) && !heightAttr.includes('%')) {
        height = heightNum;
      }
    }
    if ((width === 800 || height === 600) && svgElement.getAttribute('viewBox')) {
      const viewBox = svgElement.getAttribute('viewBox').split(/\s+|,/);
      if (viewBox.length === 4) {
        const vbWidth = parseFloat(viewBox[2]);
        const vbHeight = parseFloat(viewBox[3]);
        if (!isNaN(vbWidth) && width === 800) width = vbWidth;
        if (!isNaN(vbHeight) && height === 600) height = vbHeight;
      }
    }
  } catch (e) {
    console.warn('Error getting SVG dimensions, using defaults:', e);
  }
  
  return {
    width: Math.max(width, 100),
    height: Math.max(height, 100)
  };
};


const createCanvasFromSvgBlob = async (svgElement, backgroundColor = '#ffffff', scale = 2) => {
  const { width, height } = getSvgDimensions(svgElement);
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  canvas.width = width * scale;
  canvas.height = height * scale;
  
  if (backgroundColor && backgroundColor !== 'transparent') {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svgElement);

  const cleanSvgString = svgString
    .replace(/&nbsp;/g, ' ')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  const svgBlob = new Blob([cleanSvgString], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timeout = setTimeout(() => {
      URL.revokeObjectURL(svgUrl);
      reject(new Error('SVG blob loading timeout'));
    }, 15000);
    
    img.addEventListener('load', () => {
      clearTimeout(timeout);
      try {
        const imgScale = Math.min(canvas.width / img.width, canvas.height / img.height);
        const scaledWidth = img.width * imgScale;
        const scaledHeight = img.height * imgScale;
        const x = (canvas.width - scaledWidth) / 2;
        const y = (canvas.height - scaledHeight) / 2;
        
        ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
        URL.revokeObjectURL(svgUrl);
        resolve(canvas);
      } catch (error) {
        clearTimeout(timeout);
        URL.revokeObjectURL(svgUrl);
        reject(new Error('Failed to draw SVG blob to canvas: ' + error.message));
      }
    });
    
    img.addEventListener('error', (event) => {
      clearTimeout(timeout);
      URL.revokeObjectURL(svgUrl);
      console.error('Blob image load error:', event);
      reject(new Error('Failed to load SVG blob'));
    });
    
    img.src = svgUrl;
  });
};


export const createCanvasFromSvg = async (svgElement, backgroundColor = '#ffffff', scale = 2) => {
  try {
    return await createCanvasFromSvgDirect(svgElement, backgroundColor, scale);
  } catch (error) {
    console.warn('Direct method failed, trying blob method:', error.message);
    return await createCanvasFromSvgBlob(svgElement, backgroundColor, scale);
  }
};

const createCanvasFromSvgDirect = async (svgElement, backgroundColor = '#ffffff', scale = 2) => {
  const { width, height } = getSvgDimensions(svgElement);
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = width * scale;
  canvas.height = height * scale;

  if (backgroundColor && backgroundColor !== 'transparent') {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svgElement);

  const cleanSvgString = svgString
    .replace(/&nbsp;/g, ' ')  
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); 

  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(cleanSvgString)}`;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('SVG loading timeout after 15 seconds'));
    }, 15000);
    
    img.addEventListener('load', () => {
      clearTimeout(timeout);
      try {
        const imgScale = Math.min(canvas.width / img.width, canvas.height / img.height);
        const scaledWidth = img.width * imgScale;
        const scaledHeight = img.height * imgScale;
        const x = (canvas.width - scaledWidth) / 2;
        const y = (canvas.height - scaledHeight) / 2;
        
        ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
        resolve(canvas);
      } catch (error) {
        clearTimeout(timeout);
        reject(new Error('Failed to draw SVG to canvas: ' + error.message));
      }
    });
    
    img.addEventListener('error', (event) => {
      clearTimeout(timeout);
      console.error('Image load error:', event);
      reject(new Error('Failed to load SVG image'));
    });
    
    try {
      img.src = svgDataUrl;
    } catch (error) {
      clearTimeout(timeout);
      reject(new Error('Failed to set SVG data URL: ' + error.message));
    }
  });
};


export const generatePngFromMermaid = async (renderResult, backgroundColor = '#ffffff', size = 'medium') => {
  try {
    const sizeToWidth = {
      'xs': 100,        
      'small': 200,
      'medium': 400,
      'large': 600,
      'xl': 800         
    };
    
    const targetWidth = sizeToWidth[size] || 400; 
    const svgElement = await getSvgEl(renderResult, backgroundColor);
    
    const { width: originalWidth } = getSvgDimensions(svgElement);
    
    const scale = targetWidth / originalWidth;
    
    const canvas = await createCanvasFromSvg(svgElement, backgroundColor, scale);

    const pngDataUrl = canvas.toDataURL('image/png');
    const pngBase64 = pngDataUrl.split(',')[1];
    canvas.remove();
    return pngBase64;
  } catch (error) {
    console.error('Error generating PNG from Mermaid:', error);
    console.error('Stack trace:', error.stack);
    
    if (renderResult && renderResult.svg) {
      console.error('SVG content causing error:', renderResult.svg);
    }
    
    throw new Error('Failed to generate PNG: ' + error.message);
  }
};

export const getBase64SVG = async (renderResult, backgroundColor = '#ffffff') => {
  try {
    const svgElement = await getSvgEl(renderResult, backgroundColor);
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgElement);
    return toBase64(svgString);
  } catch (error) {
    console.error('Error generating SVG:', error);
    throw new Error('Failed to generate SVG: ' + error.message);
  }
};
