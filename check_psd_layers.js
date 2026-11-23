import fs from 'fs';
import { readPsd } from 'ag-psd';
import 'ag-psd/initialize-canvas.js';

const buffer = fs.readFileSync('sample_test.psd');
const psd = readPsd(buffer, { skipLayerImages: false });

console.log("PSD Document properties:");
console.log("Width:", psd.width);
console.log("Height:", psd.height);
console.log("Number of children:", psd.children?.length);

if (psd.children) {
  psd.children.forEach((layer, i) => {
    console.log(`\nLayer #${i+1}: "${layer.name}"`);
    console.log(`- left: ${layer.left}, top: ${layer.top}, width: ${layer.width}, height: ${layer.height}`);
    console.log(`- hidden: ${layer.hidden}`);
    console.log(`- has canvas: ${!!layer.canvas}`);
    console.log(`- has text: ${!!layer.text}`);
    if (layer.text) {
      console.log(`  - text content: "${layer.text.text}"`);
    }
  });
}
