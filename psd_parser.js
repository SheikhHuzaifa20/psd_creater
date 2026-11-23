import fs from 'fs';
import path from 'path';
import { createCanvas, ImageData } from 'canvas';
import agPsd from 'ag-psd';

try {
  agPsd.initializeCanvas(createCanvas, (w, h) => new ImageData(w, h));
  console.log('[PSD Parser ESM] Canvas bindings initialized with node-canvas.');
} catch (err) {
  console.warn('[PSD Parser ESM] Warning initializing canvas bindings: ' + err.message);
}

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("Usage: node psd_parser.js <psd_file_path> <output_dir_path>");
  process.exit(1);
}

const psdPath = path.resolve(args[0]);
const outputDir = path.resolve(args[1]);

console.log(`[PSD Parser] Reading PSD: ${psdPath}`);
console.log(`[PSD Parser] Target Output Dir: ${outputDir}`);

const assetsDir = path.join(outputDir, 'assets');
const cssDir = path.join(assetsDir, 'css');
const jsDir = path.join(assetsDir, 'js');
const imgDir = path.join(assetsDir, 'images');

try {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.mkdirSync(cssDir, { recursive: true });
  fs.mkdirSync(jsDir, { recursive: true });
  fs.mkdirSync(imgDir, { recursive: true });
} catch (err) {
  console.error(`[PSD Parser] Failed to create directories: ${err.message}`);
  process.exit(1);
}

try {
  const psdBuffer = fs.readFileSync(psdPath);
  let psd;
  try {
    psd = agPsd.readPsd(psdBuffer, { skipLayerImages: false, skipThumbnail: true });
  } catch (parseError) {
    psd = agPsd.readPsd(psdBuffer, { skipLayerImages: true, skipCompositeImageData: true, skipThumbnail: true });
  }

  const canvasWidth = psd.width || 1440;
  const canvasHeight = psd.height || 900;

  let htmlElements = [];
  let cssRules = [];
  let googleFonts = new Set();
  let textCounter = 0;
  let imageCounter = 0;
  let shapeCounter = 0;

  function parseColor(color) {
    if (!color) return null;
    if (typeof color === 'string') return color;
    if (Array.isArray(color)) {
      const r = Math.round(Math.min(Math.max(color[0], 0), 255));
      const g = Math.round(Math.min(Math.max(color[1], 0), 255));
      const b = Math.round(Math.min(Math.max(color[2], 0), 255));
      const rawA = color[3] !== undefined ? (color[3] > 1 ? color[3] / 255 : color[3]) : 1;
      const a = parseFloat(rawA.toFixed(2));
      return a < 0.99 ? `rgba(${r}, ${g}, ${b}, ${a})` : `rgb(${r}, ${g}, ${b})`;
    }
    if (typeof color === 'object') {
      const r = Math.round(color.r !== undefined ? color.r : (color.red !== undefined ? color.red : 0));
      const g = Math.round(color.g !== undefined ? color.g : (color.green !== undefined ? color.green : 0));
      const b = Math.round(color.b !== undefined ? color.b : (color.blue !== undefined ? color.blue : 0));
      const rawA = color.a !== undefined ? color.a : (color.alpha !== undefined ? color.alpha : 1);
      const a = parseFloat(rawA.toFixed(2));
      if (a < 0.99) return `rgba(${r}, ${g}, ${b}, ${a})`;
      return `rgb(${r}, ${g}, ${b})`;
    }
    return null;
  }

  function cleanFontFamily(name) {
    if (!name) return 'Inter';
    let clean = name.replace(/-(Regular|Bold|Italic|BoldItalic|Light|Medium|SemiBold|Black|Thin|ExtraBold|ExtraLight|MT|PS|Std|Pro)$/gi, '').trim();
    clean = clean.replace(/(MT|PS|Pro|Std|Regular|Bold|Italic|Light|Medium|Semi|Black|Condensed|Narrow|Extended)$/gi, '').trim();
    if (!clean.includes(' ')) {
      clean = clean.replace(/([a-z])([A-Z])/g, '$1 $2');
    }
    return clean || 'Inter';
  }

  function collectLayers(layers, collected) {
    if (!layers || !Array.isArray(layers)) return;
    for (const layer of layers) {
      if (layer.children && layer.children.length > 0) {
        collectLayers(layer.children, collected);
      } else {
        collected.push(layer);
      }
    }
  }

  const allLayers = [];
  if (psd.children) {
    collectLayers(psd.children, allLayers);
  }

  allLayers.forEach((layer, index) => {
    if (layer.hidden) return;
    const layerId = index + 1;
    const left = layer.left || 0;
    const top = layer.top || 0;
    const right = layer.right || (left + 100);
    const bottom = layer.bottom || (top + 50);
    const width = Math.max(0, right - left);
    const height = Math.max(0, bottom - top);
    const rawName = layer.name ? layer.name.replace(/[^a-zA-Z0-9_-]/g, '_') : `layer_${layerId}`;
    const className = `el-${rawName.toLowerCase().substring(0, 25)}-${layerId}`;
    const zIndex = layerId;

    if (layer.text && layer.text.text) {
      textCounter++;
      const textData = layer.text;
      const originalText = textData.text || '';
      const htmlText = originalText.replace(/[\r\n]+/g, '<br>');

      let fontName = 'Inter';
      let fontSize = 16;
      let color = '#1e293b';

      if (textData.style) {
        if (textData.style.fontName) fontName = textData.style.fontName;
        if (textData.style.fontSize) fontSize = Math.round(textData.style.fontSize);
        if (textData.style.fillColor) color = parseColor(textData.style.fillColor) || color;
      }

      const cleanFont = cleanFontFamily(fontName);
      if (cleanFont && cleanFont !== 'sans-serif' && cleanFont !== 'serif') {
        googleFonts.add(cleanFont);
      }

      const widthCss = width > 15 ? `width: ${width}px;` : `white-space: nowrap;`;
      const heightCss = height > 15 ? `min-height: ${height}px;` : ``;

      const cssRule = `
.${className} {
  position: absolute;
  left: ${left}px;
  top: ${top}px;
  ${widthCss}
  ${heightCss}
  font-family: "${cleanFont}", sans-serif;
  font-size: ${fontSize}px;
  color: ${color};
  z-index: ${zIndex};
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}`;
      cssRules.push(cssRule);
      htmlElements.push(`    <div class="${className}">${htmlText}</div>`);
    } else if (layer.canvas && width > 0 && height > 0) {
      imageCounter++;
      const imageName = `image_${layerId}_${rawName.substring(0, 15)}.png`;
      const imagePath = path.join(imgDir, imageName);
      try {
        const buffer = layer.canvas.toBuffer('image/png');
        fs.writeFileSync(imagePath, buffer);
        const cssRule = `
.${className} {
  position: absolute;
  left: ${left}px;
  top: ${top}px;
  width: ${width}px;
  height: ${height}px;
  z-index: ${zIndex};
  object-fit: contain;
}`;
        cssRules.push(cssRule);
        htmlElements.push(`    <img src="assets/images/${imageName}" class="${className}" alt="${layer.name || 'Graphic'}">`);
      } catch (e) {}
    }
  });

  const fontLinksHtml = googleFonts.size > 0 ? `  <link href="https://fonts.googleapis.com/css2?${Array.from(googleFonts).map(f => `family=${encodeURIComponent(f)}`).join('&')}&display=swap" rel="stylesheet">\n` : '';

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Converted Website from PSD</title>
${fontLinksHtml}  <link rel="stylesheet" href="assets/css/style.css">
</head>
<body>
  <div class="psd-canvas">
${htmlElements.join('\n')}
  </div>
  <script src="assets/js/main.js"></script>
</body>
</html>
`;

  const cssContent = `*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; padding: 0; background-color: #0f172a; font-family: sans-serif; min-height: 100vh; display: flex; justify-content: center; }
.psd-canvas { position: relative; width: ${canvasWidth}px; height: ${canvasHeight}px; margin: 40px auto; background-color: #ffffff; box-shadow: 0 10px 30px rgba(0,0,0,0.3); overflow: hidden; }
${cssRules.join('\n')}
`;

  const jsContent = `document.addEventListener('DOMContentLoaded', () => { console.log('PSD Website loaded!'); });`;

  fs.writeFileSync(path.join(outputDir, 'index.html'), htmlContent, 'utf8');
  fs.writeFileSync(path.join(cssDir, 'style.css'), cssContent, 'utf8');
  fs.writeFileSync(path.join(jsDir, 'main.js'), jsContent, 'utf8');

  console.log('[PSD Parser ESM] Conversion completed successfully!');
  process.exit(0);
} catch (e) {
  console.error('[PSD Parser ESM] Error during parsing: ' + e.message);
  process.exit(1);
}