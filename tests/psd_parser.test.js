import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createCanvas } from 'canvas';
import { writePsd } from 'ag-psd';
import 'ag-psd/initialize-canvas.js';

test('parser renders solid-color shape layers as CSS instead of exporting them as images', () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'psd-parser-test-'));
  const inputPath = path.join(tempDir, 'sample.psd');
  const outputDir = path.join(tempDir, 'output');

  const shapeCanvas = createCanvas(240, 120);
  const shapeCtx = shapeCanvas.getContext('2d');
  shapeCtx.fillStyle = '#4f46e5';
  shapeCtx.fillRect(0, 0, 240, 120);

  const psd = {
    width: 800,
    height: 600,
    children: [
      {
        name: 'Solid Box Shape',
        left: 40,
        top: 40,
        right: 280,
        bottom: 160,
        canvas: shapeCanvas,
      },
      {
        name: 'Heading Text',
        left: 40,
        top: 220,
        right: 420,
        bottom: 280,
        text: {
          text: 'Hello PSD',
          style: {
            fontName: 'Inter-Bold',
            fontSize: 28,
            fillColor: { r: 15, g: 23, b: 42, a: 1 },
          },
        },
      },
    ],
  };

  const buffer = writePsd(psd);
  writeFileSync(inputPath, Buffer.from(buffer));

  const result = spawnSync(process.execPath, ['psd_parser_simple.cjs', inputPath, outputDir], {
    cwd: path.resolve('.'),
    encoding: 'utf8',
  });

  try {
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const indexHtml = readFileSync(path.join(outputDir, 'index.html'), 'utf8');
    assert.match(indexHtml, /<(?:div|section) class="el-solid_box_shape-1"><\/(?:div|section)>/, 'Expected a CSS-backed shape layer in the HTML output');
    assert.doesNotMatch(indexHtml, /<img[^>]+src="assets\/images\/image_1_/, 'Expected solid-color shape layers to avoid image exports');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
