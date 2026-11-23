const fs = require('fs');
const path = require('path');
const { createCanvas, ImageData } = require('canvas');
const agPsd = require('ag-psd');

// Initialize ag-psd canvas bindings
try {
  agPsd.initializeCanvas(createCanvas, (w, h) => new ImageData(w, h));
} catch (err) {
  console.warn('[PSD Parser] Warning: ' + err.message);
}

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node psd_to_json.cjs <psd_file_path> <output_dir_path>');
  process.exit(1);
}

const psdPath = path.resolve(args[0]);
const outputDir = path.resolve(args[1]);
const imgDir = path.join(outputDir, 'assets', 'images');

if (!fs.existsSync(imgDir)) {
  fs.mkdirSync(imgDir, { recursive: true });
}

try {
  const psdBuffer = fs.readFileSync(psdPath);
  const psd = agPsd.readPsd(psdBuffer, { skipLayerImages: false, skipThumbnail: true });

  const metadata = {
    width: psd.width,
    height: psd.height,
    layers: []
  };

  let imageCounter = 0;

  function processLayers(layers, parentList) {
    if (!layers) return;
    layers.forEach((layer, index) => {
      if (layer.hidden || (layer.opacity !== undefined && layer.opacity === 0)) return;

      const item = {
        name: layer.name,
        type: layer.children ? 'group' : (layer.text ? 'text' : 'image'),
        left: layer.left,
        top: layer.top,
        right: layer.right,
        bottom: layer.bottom,
        width: (layer.right || 0) - (layer.left || 0),
        height: (layer.bottom || 0) - (layer.top || 0),
        opacity: layer.opacity,
        blendMode: layer.blendMode || 'normal',
        clipping: !!layer.clipping
      };

      if (layer.text) {
        item.text = layer.text.text;
        const scale = Math.hypot(layer.text.transform?.[2] || 0, layer.text.transform?.[3] ?? 1);
        const normalizeStyle = style => ({
          ...style,
          fontSize: style?.fontSize === undefined ? undefined : style.fontSize * scale,
          leading: style?.leading === undefined ? undefined : style.leading * scale,
        });
        const base = normalizeStyle(layer.text.style || layer.text.styleRuns?.[0]?.style || {});
        item.textStyle = {
          ...base,
          fontName: base.font?.name || base.fontName,
          styleRuns: layer.text.styleRuns?.map(run => ({length:run.length,style:normalizeStyle(run.style)})),
          justification: layer.text.paragraphStyle?.justification,
          autoLeading: layer.text.paragraphStyle?.autoLeading || 1.2,
        };
        if (layer.canvas) {
          const textImage = `text_${++imageCounter}.png`;
          fs.writeFileSync(path.join(imgDir,textImage),layer.canvas.toBuffer('image/png'));
          item.textImagePath = `assets/images/${textImage}`;
        }
      }

      const origin = layer.vectorOrigination?.keyDescriptorList?.[0];
      const enabledEffects = Object.values(layer.effects || {}).flat().some(effect => effect && typeof effect === 'object' && effect.enabled === true);
      if (layer.vectorFill?.type === 'color' && !enabledEffects && ([1, 2, 5].includes(origin?.keyOriginType) || /^(rectangle|color fill|bg)/i.test(layer.name || ''))) {
        const radii = Object.values(origin?.keyOriginRRectRadii || {}).map(radius => radius.value || 0);
        item.shapeStyle = { fillColor: layer.vectorStroke?.fillEnabled === false ? undefined : layer.vectorFill.color, strokeColor: layer.vectorStroke?.strokeEnabled ? layer.vectorStroke.content?.color : undefined, strokeWidth: layer.vectorStroke?.strokeEnabled ? layer.vectorStroke.lineWidth?.value : undefined, radius: origin?.keyOriginType === 5 ? Math.min(item.width, item.height) / 2 : Math.max(0, ...radii) };
      }
      if (!layer.children && layer.canvas && item.type === 'image') {
        imageCounter++;
        const imageName = `layer_${imageCounter}_${(layer.name || 'image').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`;
        const imagePath = path.join(imgDir, imageName);
        const canvas = createCanvas(layer.canvas.width, layer.canvas.height);
        const context = canvas.getContext('2d');
        context.drawImage(layer.canvas, 0, 0);
        if (layer.mask?.canvas && !layer.mask.disabled) {
          context.globalCompositeOperation = 'destination-in';
          const mask = createCanvas(canvas.width, canvas.height);
          const maskContext = mask.getContext('2d');
          maskContext.fillStyle = `rgba(0,0,0,${(layer.mask.defaultColor || 0) / 255})`;
          maskContext.fillRect(0, 0, mask.width, mask.height);
          const channel = createCanvas(layer.mask.canvas.width, layer.mask.canvas.height);
          const channelContext = channel.getContext('2d');
          channelContext.drawImage(layer.mask.canvas, 0, 0);
          const pixels = channelContext.getImageData(0, 0, channel.width, channel.height);
          for (let i = 0; i < pixels.data.length; i += 4) {
            const value = layer.mask.invert ? 255 - pixels.data[i] : pixels.data[i];
            pixels.data[i + 3] = Math.round(value * pixels.data[i + 3] / 255);
          }
          channelContext.putImageData(pixels, 0, 0);
          maskContext.clearRect((layer.mask.left || 0) - (layer.left || 0), (layer.mask.top || 0) - (layer.top || 0), channel.width, channel.height);
          maskContext.drawImage(channel, (layer.mask.left || 0) - (layer.left || 0), (layer.mask.top || 0) - (layer.top || 0));
          context.drawImage(mask, 0, 0);
          context.globalCompositeOperation = 'source-over';
        }
        if (layer.clipping) {
          let base = index - 1;
          while (base >= 0 && layers[base].clipping) base--;
          if (base >= 0 && layers[base].canvas) {
            const clip = createCanvas(canvas.width, canvas.height);
            clip.getContext('2d').drawImage(layers[base].canvas, (layers[base].left || 0) - (layer.left || 0), (layers[base].top || 0) - (layer.top || 0));
            context.globalCompositeOperation = 'destination-in';
            context.drawImage(clip, 0, 0);
          }
        }
        fs.writeFileSync(imagePath, canvas.toBuffer('image/png'));
        item.imagePath = `assets/images/${imageName}`;
        if (layer.clipping) {
          let base = index - 1;
          while (base >= 0 && layers[base].clipping) base--;
          if (base >= 0) {
            const clipBase = layers[base];
            const left = Math.max(item.left || 0,clipBase.left || 0);
            const top = Math.max(item.top || 0,clipBase.top || 0);
            const right = Math.min(item.right || 0,clipBase.right || 0);
            const bottom = Math.min(item.bottom || 0,clipBase.bottom || 0);
            if (right > left && bottom > top) {
              const cropped = createCanvas(right-left,bottom-top);
              cropped.getContext('2d').drawImage(canvas,left-(item.left||0),top-(item.top||0),right-left,bottom-top,0,0,right-left,bottom-top);
              fs.writeFileSync(imagePath,cropped.toBuffer('image/png'));
              Object.assign(item,{left,top,right,bottom,width:right-left,height:bottom-top});
            }
          }
        }
      }

      if (layer.children) {
        item.children = [];
        processLayers(layer.children, item.children);
        if (!item.children.length) return;
        if (item.children.length) {
          item.left = Math.min(...item.children.map(child => child.left || 0));
          item.top = Math.min(...item.children.map(child => child.top || 0));
          item.right = Math.max(...item.children.map(child => child.right || 0));
          item.bottom = Math.max(...item.children.map(child => child.bottom || 0));
          item.width = item.right - item.left;
          item.height = item.bottom - item.top;
        }
      }

      if (item.type === 'text' && !item.text?.trim()) return;
      parentList.push(item);
    });
  }

  processLayers(psd.children, metadata.layers);

  // Render only document-wide fill/texture layers: text and content images stay editable/separate.
  const background = createCanvas(psd.width, psd.height);
  const backgroundContext = background.getContext('2d');
  let hasBackground = false;
  function paintBackground(layers,parentOpacity=1) {
    for (const item of layers || []) {
      if (item.children) { paintBackground(item.children,parentOpacity*(item.opacity ?? 1)); continue; }
      const global = item.width >= psd.width * .9 && (item.height >= psd.height * .8 || /texture|grunge|^lines$/i.test(item.name || '') || item.blendMode === 'luminosity');
      if (!global || !item.imagePath) continue;
      const png = fs.readFileSync(path.join(outputDir,item.imagePath));
      const image = new (require('canvas').Image)(); image.src = png;
      backgroundContext.globalAlpha = Math.max(0,Math.min(1,(item.opacity ?? 1)*parentOpacity));
      backgroundContext.globalCompositeOperation = item.blendMode === 'normal' || item.blendMode === 'pass through' ? 'source-over' : item.blendMode;
      backgroundContext.drawImage(image,item.left || 0,item.top || 0,item.width,item.height);
      item.documentBackground = true;
      hasBackground = true;
    }
  }
  paintBackground(metadata.layers);
  if (hasBackground) {
    fs.writeFileSync(path.join(imgDir,'page-background.png'),background.toBuffer('image/png'));
    metadata.backgroundPath='assets/images/page-background.png';
  }


  if (psd.canvas) {
    fs.writeFileSync(path.join(imgDir, 'original-design.png'), psd.canvas.toBuffer('image/png'));
    metadata.compositePath = 'assets/images/original-design.png';
    const ratio = Math.min(1, 960 / psd.width, 4000 / psd.height);
    const preview = createCanvas(Math.max(1, Math.round(psd.width * ratio)), Math.max(1, Math.round(psd.height * ratio)));
    const ctx = preview.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, preview.width, preview.height);
    ctx.drawImage(psd.canvas, 0, 0, preview.width, preview.height);
    fs.writeFileSync(path.join(imgDir, 'psd-preview.jpg'), preview.toBuffer('image/jpeg', {quality:0.8}));
    metadata.previewPath = 'assets/images/psd-preview.jpg';
  }
  fs.writeFileSync(path.join(outputDir, 'layers.json'), JSON.stringify(metadata, null, 2));
  console.log('Successfully extracted layers and images.');
  process.exit(0);
} catch (err) {
  console.error(err);
  process.exit(1);
}
