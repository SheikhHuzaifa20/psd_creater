// PSD Parser - Complete PSD to HTML/CSS Engine with Node Canvas Support
// Extracts text, custom typography, images (PNG), colors, and absolute visual coordinates

const fs = require('fs');
const path = require('path');
const { createCanvas, ImageData, Image } = require('canvas');
const agPsd = require('ag-psd');

// Initialize ag-psd canvas bindings for node-canvas
try {
  agPsd.initializeCanvas(createCanvas, (w, h) => new ImageData(w, h));
  console.log('[PSD Parser] Canvas bindings initialized with node-canvas.');
} catch (err) {
  console.warn('[PSD Parser] Warning initializing canvas bindings: ' + err.message);
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node psd_parser_simple.cjs <psd_file_path> <output_dir_path>');
  process.exit(1);
}

const psdPath = path.resolve(args[0]);
const outputDir = path.resolve(args[1]);

console.log(`[PSD Parser] Reading PSD: ${psdPath}`);
console.log(`[PSD Parser] Target Output Dir: ${outputDir}`);

// Ensure output directories exist
const assetsDir = path.join(outputDir, 'assets');
const cssDir = path.join(assetsDir, 'css');
const jsDir = path.join(assetsDir, 'js');
const imgDir = path.join(assetsDir, 'images');
const fontsDir = path.join(assetsDir, 'fonts');

try {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.mkdirSync(cssDir, { recursive: true });
  fs.mkdirSync(jsDir, { recursive: true });
  fs.mkdirSync(imgDir, { recursive: true });
  fs.mkdirSync(fontsDir, { recursive: true });
} catch (err) {
  console.error(`[PSD Parser] Failed to create directories: ${err.message}`);
  process.exit(1);
}

try {
  // Read the PSD file buffer
  const psdBuffer = fs.readFileSync(psdPath);
  console.log(`[PSD Parser] File size: ${psdBuffer.length} bytes`);

  let psd;
  let usingFallback = false;

  try {
    // Attempt full PSD parse including layer image canvases
    psd = agPsd.readPsd(psdBuffer, { skipLayerImages: false, skipThumbnail: true });
    console.log(`[PSD Parser] PSD parsed successfully with full layer images.`);
  } catch (parseError) {
    console.warn(`[PSD Parser] Layer image parsing notice: ${parseError.message}`);
    try {
      // Retry without layer images if image decoding fails
      psd = agPsd.readPsd(psdBuffer, { skipLayerImages: true, skipCompositeImageData: true, skipThumbnail: true });
      console.log(`[PSD Parser] PSD structure parsed (layer images skipped).`);
    } catch (fallbackError) {
      console.error(`[PSD Parser] Could not parse PSD structure: ${fallbackError.message}`);
      throw new Error('Unable to decode PSD: ' + fallbackError.message);
    }
  }

  const canvasWidth = psd.width || 1440;
  const canvasHeight = psd.height || 900;

  console.log(`[PSD Parser] Canvas dimensions: ${canvasWidth}x${canvasHeight}`);

  let htmlElements = [];
  let cssRules = [];
  let googleFonts = new Set();
  let textCounter = 0;
  let imageCounter = 0;
  let shapeCounter = 0;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }

  // Helper function to parse colors into CSS format
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

  function isSimpleFillLayer(layer) {
    if (!layer) return false;
    if (layer.vectorFill || layer.solidColor) return !layer.canvas;
    if (!layer.canvas) return false;
    const pixels = layer.canvas.getContext('2d').getImageData(0, 0, layer.canvas.width, layer.canvas.height).data;
    for (let i = 4; i < pixels.length; i += 4) {
      if (pixels[i] !== pixels[0] || pixels[i+1] !== pixels[1] || pixels[i+2] !== pixels[2] || pixels[i+3] !== pixels[3]) return false;
    }
    return pixels.length > 0 && pixels[3] === 255;
  }

  function sampleDominantColor(layer) {
    if (!layer || !layer.canvas) return null;

    try {
      const canvas = layer.canvas;
      const width = Math.max(1, canvas.width || 1);
      const height = Math.max(1, canvas.height || 1);
      const ctx = canvas.getContext ? canvas.getContext('2d') : null;
      if (!ctx) return null;

      const imageData = ctx.getImageData(0, 0, width, height).data;
      const counts = new Map();
      let bestKey = null;
      let bestCount = 0;

      for (let i = 0; i < imageData.length; i += 4) {
        const alpha = imageData[i + 3];
        if (alpha < 16) continue;
        const key = `${imageData[i]}_${imageData[i + 1]}_${imageData[i + 2]}`;
        const count = (counts.get(key) || 0) + 1;
        counts.set(key, count);
        if (count > bestCount) {
          bestCount = count;
          bestKey = key;
        }
      }

      if (!bestKey) return null;
      const [r, g, b] = bestKey.split('_').map(Number);
      return `rgb(${r}, ${g}, ${b})`;
    } catch (err) {
      return null;
    }
  }

  // Helper to clean font family names for Google Fonts compatibility
  function cleanFontFamily(name) {
    if (!name) return 'Inter';
    let clean = name.replace(/-(Regular|Bold|Italic|BoldItalic|Light|Medium|SemiBold|Black|Thin|ExtraBold|ExtraLight|MT|PS|Std|Pro)$/gi, '').trim();
    clean = clean.replace(/(MT|PS|Pro|Std|Regular|Bold|Italic|Light|Medium|Semi|Black|Condensed|Narrow|Extended)$/gi, '').trim();
    if (!clean.includes(' ')) {
      clean = clean.replace(/([a-z])([A-Z])/g, '$1 $2');
    }
    return clean || 'Inter';
  }

  function sanitizeLayerName(name) {
    if (!name) return 'unnamed';
    return name
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .substring(0, 30)
      .toLowerCase() || 'layer';
  }

  function getSemanticTag(name, bounds = null) {
    if (name) {
      const lower = name.toLowerCase();
      if (/(header|hero|top|banner|navbar|navigation|logo)/.test(lower)) return 'header';
      if (/(footer|bottom|copyright|legal)/.test(lower)) return 'footer';
      if (/(sidebar|aside|nav|menu|links)/.test(lower)) return 'aside';
      if (/(form|contact|quote|subscribe|login|signup|newsletter)/.test(lower)) return 'form';
      if (/(section|content|cards|panel|box|row|container|wrapper|main|body|page|card|package|payment|invoice|billing|contract|queue|status|details)/.test(lower)) return 'section';
    }
    if (!bounds) return 'div';
    const widthRatio = bounds.width / canvasWidth;
    const heightRatio = bounds.height / canvasHeight;
    if (bounds.top <= 120 && widthRatio > 0.6) return 'header';
    if (bounds.top >= canvasHeight - 160 && widthRatio > 0.6) return 'footer';
    if (bounds.left <= 60 && widthRatio < 0.35 && heightRatio > 0.5) return 'aside';
    if (bounds.left > 60 && widthRatio > 0.5 && bounds.top > 120) return 'main';
    return 'section';
  }

  function getBootstrapClass(name, tag) {
    if (!name) return '';
    const lower = name.toLowerCase();
    if (tag === 'form') return 'row g-3 psd-form';
    if (/(header|hero|top|banner|navbar|logo)/.test(lower)) return 'container-fluid px-0 py-3';
    if (/(footer|bottom|legal|copyright)/.test(lower)) return 'container-fluid px-0 py-3';
    if (/(sidebar|aside|navigation|nav|menu|links|dashboard)/.test(lower)) return 'col-lg-3 col-md-4 mb-4';
    if (/(main|content|body|page|panel|card|section|wrapper|container)/.test(lower)) return 'col-lg-9 col-md-8 mb-4';
    if (/(row|grid|horizontal|group|stack|columns)/.test(lower)) return 'row gx-3 gy-3';
    if (/(card|panel|box|section|wrapper)/.test(lower)) return 'container p-3 mb-4 shadow-sm rounded bg-white';
    return '';
  }

  function buildLayerTree(layers) {
    if (!layers || !Array.isArray(layers)) return [];
    return layers.filter(layer => !layer.hidden).map(layer => ({
      layer,
      children: layer.children && layer.children.length ? buildLayerTree(layer.children) : null,
    }));
  }

  function countLeafNodes(nodes) {
    if (!nodes || !Array.isArray(nodes)) return 0;
    return nodes.reduce((count, node) => {
      if (node.children && node.children.length) {
        return count + countLeafNodes(node.children);
      }
      return count + 1;
    }, 0);
  }

  function getLayerBounds(layer) {
    const left = layer.left || 0;
    const top = layer.top || 0;
    const right = layer.right || (left + (layer.width || 100));
    const bottom = layer.bottom || (top + (layer.height || 50));
    return {
      left,
      top,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top),
    };
  }

  let groupCounter = 0;
  let leafCounter = 0;

  function renderLayerNodes(nodes, parentTag = 'div', offset = { x: 0, y: 0 }) {
    if (!nodes || !Array.isArray(nodes)) return [];
    return nodes.map(node => renderLayerNode(node, parentTag, offset)).filter(Boolean);
  }

  function renderLayerNode(node, parentTag = 'div', offset = { x: 0, y: 0 }) {
    if (!node || !node.layer) return '';
    const layer = node.layer;
    if (node.children && node.children.length) {
      const bounds = getLayerBounds(layer);
      const inferredTag = getSemanticTag(layer.name, bounds);
      const tag = inferredTag === 'form' ? 'section' : inferredTag;
      const groupName = sanitizeLayerName(layer.name || 'group');
      const className = `${groupName}-group-${++groupCounter}`;
      // PSD child coordinates are already in document space. Keep group wrappers
      // neutral so nested groups never add their origins or Bootstrap gutters.
      const childOffset = offset;
      const classNames = className;
      const bootstrapClass = '';
      cssRules.push(`\n.${className} { display: contents; }`);

      const inner = renderLayerNodes(node.children, tag, childOffset).join('\n');
      if (false) {
        return `    <${tag} class="${classNames} row gx-3 gy-3">\n${inner}\n    </${tag}>`;
      }
      return `    <${tag} class="${classNames}">\n${inner}\n    </${tag}>`;
    }
    leafCounter++;
    return renderLeafLayer(layer, leafCounter, parentTag, offset);
  }

  function renderLeafLayer(layer, layerId, parentTag, offset = { x: 0, y: 0 }) {
    const absoluteLeft = layer.left || 0;
    const absoluteTop = layer.top || 0;
    const left = absoluteLeft - offset.x;
    const top = absoluteTop - offset.y;
    const right = layer.right || (absoluteLeft + (layer.width || 100));
    const bottom = layer.bottom || (absoluteTop + (layer.height || 50));
    const width = Math.max(0, right - absoluteLeft);
    const height = Math.max(0, bottom - absoluteTop);
    const rawName = layer.name ? sanitizeLayerName(layer.name) : `layer_${layerId}`;
    const className = `el-${rawName}-${layerId}`;
    const zIndex = layerId;
    const semanticTag = getSemanticTag(layer.name);
    const wrapperTag = null;
    const wrapperClass = className;

    if (layer.text && layer.text.text) {
      textCounter++;
      const textData = layer.text;
      const originalText = textData.text || '';
      let htmlText = escapeHtml(originalText).replace(/\r\n|\r|\n/g, '<br>');

      let fontName = 'Inter';
      let fontSize = 16;
      let color = '#1e293b';
      let fontWeight = '400';
      let fontStyle = 'normal';
      let alignment = 'left';
      let lineHeight = 'normal';
      let letterSpacing = 'normal';
      let backgroundColor = null;

      if (textData.style) {
        const s = textData.style;
        if (s.font?.name || s.fontName) fontName = s.font?.name || s.fontName;
        if (s.fontSize) fontSize = Math.round(s.fontSize);
        if (s.fillColor) color = parseColor(s.fillColor) || color;
        else if (s.colors && s.colors[0]) color = parseColor(s.colors[0]) || color;
        if (s.leading) lineHeight = `${Math.round(s.leading)}px`;
        if (s.tracking) letterSpacing = `${(s.tracking / 1000 * fontSize).toFixed(1)}px`;
        if (s.backgroundColor) backgroundColor = parseColor(s.backgroundColor);
      }

      if (textData.styleRuns && textData.styleRuns.length > 0) {
        const firstRun = textData.styleRuns[0];
        if (firstRun.style) {
          const rs = firstRun.style;
          if ((rs.font?.name || rs.fontName) && fontName === 'Inter') fontName = rs.font?.name || rs.fontName;
          if (rs.fontSize && fontSize === 16) fontSize = Math.round(rs.fontSize);
          if (rs.fillColor && color === '#1e293b') color = parseColor(rs.fillColor) || color;
          else if (rs.colors && rs.colors[0] && color === '#1e293b') color = parseColor(rs.colors[0]) || color;
          if (rs.leading && lineHeight === 'normal') lineHeight = `${Math.round(rs.leading)}px`;
        }
      }

      if (textData.paragraphStyle && textData.paragraphStyle.justification) {
        const j = textData.paragraphStyle.justification;
        if (j === 'right') alignment = 'right';
        else if (j === 'center') alignment = 'center';
        else if (j === 'justify' || j === 'justifyAll') alignment = 'justify';
      }

      const cleanFont = cleanFontFamily(fontName);
      if (cleanFont && cleanFont !== 'sans-serif' && cleanFont !== 'serif' && cleanFont !== 'monospace') {
        googleFonts.add(cleanFont);
      }

      const fontLower = fontName.toLowerCase();
      if (fontLower.includes('black') || fontLower.includes('heavy')) fontWeight = '900';
      else if (fontLower.includes('extrabold') || fontLower.includes('ultra')) fontWeight = '800';
      else if (fontLower.includes('semibold') || fontLower.includes('semi-bold') || fontLower.includes('demibold')) fontWeight = '600';
      else if (fontLower.includes('bold')) fontWeight = '700';
      else if (fontLower.includes('medium')) fontWeight = '500';
      else if (fontLower.includes('light') || fontLower.includes('thin')) fontWeight = '300';

      if (fontLower.includes('italic') || fontLower.includes('oblique')) fontStyle = 'italic';

      if (textData.style?.fauxBold) fontWeight = '700';
      if (textData.style?.fauxItalic) fontStyle = 'italic';
      if (textData.styleRuns?.length) {
        let cursor = 0;
        htmlText = textData.styleRuns.map(run => {
          const text = originalText.slice(cursor, cursor + run.length);
          cursor += run.length;
          const style = {...textData.style, ...run.style};
          const name = style.font?.name || style.fontName || fontName;
          const weight = /semi.?bold|demibold/i.test(name) ? 600 : /bold/i.test(name) || style.fauxBold ? 700 : /medium/i.test(name) ? 500 : 400;
          const rules = `color:${parseColor(style.fillColor) || color};font-size:${style.fontSize || fontSize}px;font-weight:${weight};font-style:${style.fauxItalic || /italic/i.test(name) ? 'italic' : 'normal'}`;
          return `<span style="${rules}">${escapeHtml(text).replace(/\r\n|\r|\n/g, '<br>')}</span>`;
        }).join('') + escapeHtml(originalText.slice(cursor));
      }
      const widthCss = width > 15 ? `width: ${width}px;` : `white-space: nowrap;`;
      const heightCss = height > 15 ? `min-height: ${height}px;` : ``;

      const labelText = originalText.trim();
      if (false) {
        const lowerText = labelText.toLowerCase();
        const fieldId = `${className}-field`;
        if (/submit|send|get quote|start|book now|apply|save|mark paid|generate invoice|checkout|continue/.test(lowerText)) {
          const buttonClass = `${className}-button btn btn-primary w-100`;
          cssRules.push(`\n.${buttonClass.replace(/\s+/g, '.')} { position: absolute; left: ${left}px; top: ${top}px; width: ${width}px; height: ${height}px; z-index: ${zIndex}; border: none; cursor: pointer; box-sizing: border-box; }`);
          return `    <div class="col-12"><button type="submit" class="${buttonClass}">${labelText}</button></div>`;
        }

        if (/email/.test(lowerText)) {
          return `    <div class="col-lg-6 mb-3"><label for="${fieldId}" class="form-label">${labelText}</label><input id="${fieldId}" type="email" class="form-control" placeholder="${labelText}" readonly /></div>`;
        }

        if (/phone|mobile|contact/.test(lowerText)) {
          return `    <div class="col-lg-6 mb-3"><label for="${fieldId}" class="form-label">${labelText}</label><input id="${fieldId}" type="tel" class="form-control" placeholder="${labelText}" readonly /></div>`;
        }

        if (/name/.test(lowerText)) {
          return `    <div class="col-lg-6 mb-3"><label for="${fieldId}" class="form-label">${labelText}</label><input id="${fieldId}" type="text" class="form-control" placeholder="${labelText}" readonly /></div>`;
        }

        if (/message|description|details|notes|comments/.test(lowerText)) {
          return `    <div class="col-12 mb-3"><label for="${fieldId}" class="form-label">${labelText}</label><textarea id="${fieldId}" class="form-control" placeholder="${labelText}" rows="3" readonly></textarea></div>`;
        }

        if (/status|method|plan|package|price|dates|signed|contract|payment|queue/.test(lowerText)) {
          return `    <div class="col-lg-6 mb-3"><label for="${fieldId}" class="form-label">${labelText}</label><input id="${fieldId}" type="text" class="form-control" placeholder="${labelText}" readonly /></div>`;
        }
      }

      let cssRule = `\n/* Text Layer: ${layer.name} */\n.${className} {\n  position: absolute;\n  left: ${left}px;\n  top: ${top}px;\n  ${widthCss}\n  ${heightCss}\n  font-family: "${cleanFont}", sans-serif;\n  font-size: ${fontSize}px;\n  font-weight: ${fontWeight};\n  font-style: ${fontStyle};\n  color: ${color};\n  line-height: ${lineHeight};\n  letter-spacing: ${letterSpacing};\n  text-align: ${alignment};\n  z-index: ${zIndex};\n  margin: 0;\n  padding: 0;\n  box-sizing: border-box;\n  overflow: visible;\n  white-space: pre;\n`;
      if (backgroundColor) {
        cssRule += `  background-color: ${backgroundColor};\n  padding: 8px 16px;\n  border-radius: 6px;\n`;
      }
      cssRule += `}`;
      cssRules.push(cssRule);
      if (wrapperTag) {
        return `    <${wrapperTag} class="${wrapperClass}">${htmlText}</${wrapperTag}>`;
      }
      return `    <div class="${wrapperClass}">${htmlText}</div>`;
    }

    if (layer.canvas && width > 0 && height > 0 && !isSimpleFillLayer(layer)) {
      imageCounter++;
      const imageName = `image_${layerId}_${rawName.substring(0, 15)}.png`;
      const imagePath = path.join(imgDir, imageName);

      try {
        const buffer = layer.canvas.toBuffer('image/png');
        fs.writeFileSync(imagePath, buffer);

        const cssRule = `\n/* Image Layer: ${layer.name} */\n.${className} {\n  position: absolute;\n  left: ${left}px;\n  top: ${top}px;\n  width: ${width}px;\n  height: ${height}px;\n  z-index: ${zIndex};\n  box-sizing: border-box;\n}`;
        cssRules.push(cssRule);
        const imgTag = `<img src="assets/images/${imageName}" alt="${escapeHtml(layer.name || 'Graphic')}" class="psd-image" style="width:100%; height:100%; object-fit: contain; display:block;" />`;
        if (wrapperTag) {
          return `    <${wrapperTag} class="${wrapperClass}">${imgTag}</${wrapperTag}>`;
        }
        return `    <div class="${wrapperClass}">${imgTag}</div>`;
      } catch (imgErr) {
        console.warn(`[PSD Parser] Could not export canvas image for layer "${layer.name}": ${imgErr.message}`);
        return '';
      }
    }

    if (width > 0 && height > 0 && layer.name && !layer.name.startsWith('<')) {
      shapeCounter++;
      let bgColor = null;
      let borderRadius = '0';

      if (layer.vectorFill && layer.vectorFill.color) {
        bgColor = parseColor(layer.vectorFill.color);
      } else if (layer.solidColor) {
        bgColor = parseColor(layer.solidColor);
      } else if (layer.canvas) {
        bgColor = sampleDominantColor(layer);
      }

      if (!bgColor) {
        bgColor = 'rgba(241, 245, 249, 0.5)';
      }

      // Shape geometry must not be guessed from square bounds.

      const cssRule = `\n/* Shape Layer: ${layer.name} */\n.${className} {\n  position: absolute;\n  left: ${left}px;\n  top: ${top}px;\n  width: ${width}px;\n  height: ${height}px;\n  background-color: ${bgColor};\n  border-radius: ${borderRadius};\n  z-index: ${zIndex};\n  box-sizing: border-box;\n}`;
      cssRules.push(cssRule);
      if (wrapperTag) {
        return `    <${wrapperTag} class="${wrapperClass}"></${wrapperTag}>`;
      }
      return `    <div class="${wrapperClass}"></div>`;
    }

    return '';
  }

  const layerTree = [];
  if (psd.children) {
    layerTree.push(...buildLayerTree(psd.children));
  }

  console.log(`[PSD Parser] Total active layers found: ${countLeafNodes(layerTree)}`);
  htmlElements.push(...renderLayerNodes(layerTree));

  if (textCounter === 0 && imageCounter === 0 && shapeCounter === 0) {
    if (!psd.canvas) throw new Error('PSD contains no readable layers or composite image. Save with Maximize Compatibility in Photoshop.');
    fs.writeFileSync(path.join(imgDir, 'design.png'), psd.canvas.toBuffer('image/png'));
    htmlElements.push(`<img src="assets/images/design.png" alt="PSD design" style="width:100%;height:100%;display:block">`);
  }
  if (psd.canvas) {
    fs.writeFileSync(path.join(imgDir, 'original-design.png'), psd.canvas.toBuffer('image/png'));
    fs.writeFileSync(path.join(outputDir, 'reference.html'), `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Original PSD reference</title></head><body style="margin:0"><img src="assets/images/original-design.png" alt="Original PSD rendered design" style="display:block;width:100%;height:auto"></body></html>`);
  }
  fs.writeFileSync(path.join(outputDir, 'README.txt'), 'Open index.html for editable HTML/CSS layers. The entire design scales proportionally to the viewport; this is not a mobile reflow. Open reference.html, when available, for the saved Photoshop composite. Fonts, masks, clipping and layer effects may differ in editable HTML. No AI service is used and no file is sent to an external AI. Bootstrap CSS is included locally.');

  // Build Google Fonts links
  let fontLinksHtml = '';
  if (googleFonts.size > 0) {
    const fontsQuery = Array.from(googleFonts)
      .map(f => `family=${encodeURIComponent(f)}:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,700`)
      .join('&');
    fontLinksHtml = `  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?${fontsQuery}&display=swap" rel="stylesheet">\n`;
  } else {
    fontLinksHtml = `  <!-- Default Google Font -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">\n`;
  }

  // Write index.html
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Converted Website from PSD</title>
${fontLinksHtml}  <link rel="stylesheet" href="assets/css/bootstrap.min.css">
  <!-- Stylesheet -->
  <link rel="stylesheet" href="assets/css/style.css">
</head>
<body>

  <div class="container-fluid page-shell">
    <div class="psd-viewport">
      <div class="psd-frame">
        <div class="psd-stage">
          <div class="psd-canvas">
${htmlElements.join('\n')}
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- JavaScript Interactions & Responsive Scaling -->
  <script src="assets/js/main.js" defer></script>
</body>
</html>
`;

  // Write style.css
  const cssContent = `/* =========================================
   Generated from PSD — PSD2HTML AI Engine
   Canvas: ${canvasWidth} x ${canvasHeight}px
   Extracted: ${textCounter} text, ${imageCounter} graphics, ${shapeCounter} shapes
   ========================================= */

*, *::before, *::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  background-color: #ffffff;
  color: #0f172a;
  font-family: 'Inter', sans-serif;
  min-height: 100vh;
  overflow-x: hidden;
}

.page-shell {
  padding: 0;
  width: 100%;
  overflow: hidden;
}

.psd-canvas {
  position: relative;
  width: ${canvasWidth}px;
  height: ${canvasHeight}px;
  margin: 0;
  background-color: #ffffff;
  overflow: hidden;
  transform-origin: top left;
}

.psd-form {
  padding: 1rem;
  background-color: rgba(255, 255, 255, 0.95);
}

` + cssRules.join('\n') + `
`;

  // Scale fixed design coordinates and reserve the scaled height in normal flow.
  const jsContent = `document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.querySelector('.psd-canvas');
    const viewport = document.querySelector('.psd-viewport');
    function resize() {
      const scale = Math.min(1, viewport.clientWidth / ${canvasWidth});
      canvas.style.transform = 'scale(' + scale + ')';
      viewport.style.height = (${canvasHeight} * scale) + 'px';
    }
    resize();
    window.addEventListener('resize', resize);
    if (window.ResizeObserver) new ResizeObserver(resize).observe(viewport);
  });`;

  // Write placeholder SVG
  const svgPlaceholder = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect width="400" height="300" fill="#f1f5f9"/>
  <rect x="20" y="20" width="360" height="260" rx="8" fill="#e2e8f0"/>
  <text x="200" y="145" font-family="Arial" font-size="18" text-anchor="middle" fill="#94a3b8">PSD Asset Layer</text>
  <text x="200" y="170" font-family="Arial" font-size="12" text-anchor="middle" fill="#cbd5e1">Exported Image</text>
</svg>`;

  const bootstrapPath = path.join(__dirname, 'node_modules/bootstrap/dist/css/bootstrap.min.css');
  if (!fs.existsSync(bootstrapPath)) throw new Error('Bootstrap dependency missing. Run npm install.');
  fs.copyFileSync(bootstrapPath, path.join(cssDir, 'bootstrap.min.css'));

  // Save generated files
  fs.writeFileSync(path.join(outputDir, 'index.html'), htmlContent, 'utf8');
  fs.writeFileSync(path.join(cssDir, 'style.css'), cssContent, 'utf8');
  fs.writeFileSync(path.join(jsDir, 'main.js'), jsContent, 'utf8');
  fs.writeFileSync(path.join(imgDir, 'placeholder.svg'), svgPlaceholder, 'utf8');

  console.log(`[PSD Parser] Conversion completed successfully!`);
  console.log(`[PSD Parser] Extracted ${textCounter} text elements.`);
  console.log(`[PSD Parser] Extracted ${imageCounter} image/graphic layers.`);
  console.log(`[PSD Parser] Extracted ${shapeCounter} shape layers.`);
  console.log(`[PSD Parser] Google Fonts linked: ${Array.from(googleFonts).join(', ') || 'Inter'}`);
  console.log(`[PSD Parser] Output Directory: ${outputDir}`);
  console.log(`[PSD Parser]   ✅ index.html`);
  console.log(`[PSD Parser]   ✅ assets/css/style.css`);
  console.log(`[PSD Parser]   ✅ assets/js/main.js`);
  console.log(`[PSD Parser]   ✅ assets/images/`);

  process.exit(0);

} catch (e) {
  console.error('[PSD Parser] Fatal error during parsing: ' + e.message);
  console.error(e.stack);
  process.exit(1);
}
