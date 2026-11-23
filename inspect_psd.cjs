const fs = require('fs');
const path = require('path');
const { createCanvas, ImageData } = require('canvas');
const agPsd = require('ag-psd');
agPsd.initializeCanvas(createCanvas, (w, h) => new ImageData(w, h));
const psdPath = path.resolve('sample_test.psd');
const buf = fs.readFileSync(psdPath);
const psd = agPsd.readPsd(buf, { skipLayerImages: true, skipThumbnail: true });
function dump(layers, depth = 0) {
  if (!layers) return;
  for (const layer of layers) {
    console.log(
      ' '.repeat(depth * 2) +
        `- ${layer.name || '<unnamed>'} type=${layer.type || layer.kind || '<none>'} left=${layer.left || 0} top=${layer.top || 0} right=${layer.right || ''} bottom=${layer.bottom || ''} hidden=${layer.hidden}`
    );
    if (layer.children) dump(layer.children, depth + 1);
  }
}
dump(psd.children);
