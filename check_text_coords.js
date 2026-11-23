import fs from 'fs';
import { readPsd } from 'ag-psd';
import 'ag-psd/initialize-canvas.js';

const buffer = fs.readFileSync('sample_test.psd');
const psd = readPsd(buffer, { skipLayerImages: false });

if (psd.children) {
  const textLayer = psd.children.find(l => l.text);
  if (textLayer) {
    console.log("Found text layer properties:");
    console.log(JSON.stringify(textLayer, (key, value) => {
      if (key === 'canvas') return '[Canvas]';
      return value;
    }, 2));
  } else {
    console.log("No text layer found!");
  }
}
