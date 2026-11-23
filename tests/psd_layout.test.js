import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { writePsd } from 'ag-psd';
import 'ag-psd/initialize-canvas.js';

test('nested groups keep document coordinates and load proportional viewport scaling', () => {
 const dir = mkdtempSync(path.join(tmpdir(), 'psd-layout-'));
 try {
  writeFileSync(path.join(dir, 'input.psd'), Buffer.from(writePsd({width:1920,height:1200,children:[{name:'Hero section',children:[{name:'Inner group',children:[{name:'Title',left:400,top:200,right:900,bottom:250,text:{text:'Book Editing',style:{font:{name:'Arial-BoldMT'},fontSize:48,fillColor:{r:0,g:0,b:0}}}}]}]}]})));
  const run = spawnSync(process.execPath,['psd_parser_simple.cjs',path.join(dir,'input.psd'),path.join(dir,'out')],{encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
  const html = readFileSync(path.join(dir,'out/index.html'),'utf8');
  const css = readFileSync(path.join(dir,'out/assets/css/style.css'),'utf8');
  assert.match(html,/src="assets\/js\/main.js"/);
  assert.match(css,/width: 1920px/);
  assert.doesNotMatch(css,/margin-top: 200px/);
  assert.match(css,/font-weight: 700/);
 } finally {rmSync(dir,{recursive:true,force:true});}
});

test('mixed text colors, escaped content and offline Bootstrap survive export', () => {
 const dir = mkdtempSync(path.join(tmpdir(), 'psd-styles-'));
 try {
  writeFileSync(path.join(dir, 'input.psd'), Buffer.from(writePsd({width:800,height:600,children:[{name:'Title',left:30,top:30,right:500,bottom:90,text:{text:'Book <Edit>',style:{font:{name:'ArialMT'},fontSize:40},styleRuns:[{length:5,style:{fillColor:{r:0,g:0,b:0}}},{length:6,style:{fillColor:{r:0,g:100,b:255},font:{name:'Arial-BoldMT'}}}]}}]})));
  const run = spawnSync(process.execPath,['psd_parser_simple.cjs',path.join(dir,'input.psd'),path.join(dir,'out')],{encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
  const html = readFileSync(path.join(dir,'out/index.html'),'utf8');
  assert.match(html,/&lt;Edit&gt;/);
  assert.match(html,/color:rgb\(0, 100, 255\)/);
  assert.match(html,/font-weight:700/);
  assert.match(html,/href="assets\/css\/bootstrap.min.css"/);
  assert.ok(readFileSync(path.join(dir,'out/assets/css/bootstrap.min.css'),'utf8').length > 100000);
 } finally {rmSync(dir,{recursive:true,force:true});}
});
