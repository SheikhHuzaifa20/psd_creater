import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createCanvas, loadImage} from 'canvas';
import {writePsd} from 'ag-psd';
import 'ag-psd/initialize-canvas.js';

function extract(document) {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'psd-extract-'));
 fs.writeFileSync(path.join(dir,'input.psd'),Buffer.from(writePsd(document)));
 const run=spawnSync(process.execPath,['psd_to_json.cjs',path.join(dir,'input.psd'),path.join(dir,'out')],{encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);
 return {dir,data:JSON.parse(fs.readFileSync(path.join(dir,'out/layers.json'),'utf8'))};
}

test('extraction preserves mixed text runs and ignores empty and hidden groups',()=>{
 const {dir,data}=extract({width:800,height:600,children:[{name:'Hero',children:[{name:'Empty group',children:[]},{name:'Title',left:50,top:100,right:500,bottom:150,text:{text:'Blue title',style:{font:{name:'ArialMT'}},styleRuns:[{length:5,style:{fontSize:48,fillColor:{r:0,g:109,b:233}}},{length:5,style:{fontSize:32,fillColor:{r:0,g:0,b:0}}}]}}]},{name:'Hidden',hidden:true,children:[{name:'Secret',text:{text:'Hidden text'}}]}]});
 try {
  assert.equal(data.layers.length,1);
  assert.equal(data.layers[0].children.length,1);
  assert.equal(data.layers[0].top,100);
  assert.equal(Math.round(data.layers[0].children[0].textStyle.styleRuns[0].style.fillColor.b),233);
  assert.ok(data.previewPath);
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test('grayscale masks become image alpha instead of leaving masked pixels visible',async()=>{
 const canvas=createCanvas(40,20),mask=createCanvas(40,20);
 const ctx=canvas.getContext('2d');ctx.fillStyle='#f00';ctx.fillRect(0,0,40,20);
 const m=mask.getContext('2d');m.fillStyle='#000';m.fillRect(0,0,40,20);m.fillStyle='#fff';m.fillRect(20,0,20,20);
 const {dir,data}=extract({width:100,height:100,children:[{name:'Masked image',left:0,top:0,right:40,bottom:20,canvas,mask:{left:0,top:0,right:40,bottom:20,defaultColor:0,canvas:mask}}]});
 try {
  const image=await loadImage(path.join(dir,'out',data.layers[0].imagePath));
  const out=createCanvas(40,20);out.getContext('2d').drawImage(image,0,0);
  assert.equal(out.getContext('2d').getImageData(5,5,1,1).data[3],0);
  assert.equal(out.getContext('2d').getImageData(30,5,1,1).data[3],255);
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test('document background preserves luminosity and opacity, while outlined shapes stay unfilled',async()=>{
 const base=createCanvas(100,100),texture=createCanvas(100,100),outline=createCanvas(40,20);
 base.getContext('2d').fillStyle='rgb(51,58,58)';base.getContext('2d').fillRect(0,0,100,100);
 texture.getContext('2d').fillStyle='rgb(230,140,20)';texture.getContext('2d').fillRect(0,0,100,100);
 const {dir,data}=extract({width:100,height:100,children:[
  {name:'Color Fill 1',left:0,top:0,right:100,bottom:100,canvas:base},
  {name:'grunge texture',left:0,top:0,right:100,bottom:100,canvas:texture,blendMode:'luminosity',opacity:.3},
  {name:'Rectangle outline',left:20,top:40,right:60,bottom:60,canvas:outline,vectorFill:{type:'color',color:{r:0,g:0,b:40}},vectorStroke:{strokeEnabled:true,fillEnabled:false,lineWidth:{value:2,units:'Pixels'},lineDashOffset:{value:0,units:'Points'},lineCapType:'butt',lineJoinType:'miter',lineAlignment:'center',content:{type:'color',color:{r:255,g:255,b:255}},opacity:1}},
 ]});
 try {
  assert.ok(data.backgroundPath);
  const image=await loadImage(path.join(dir,'out',data.backgroundPath));const canvas=createCanvas(100,100);canvas.getContext('2d').drawImage(image,0,0);
  const pixel=canvas.getContext('2d').getImageData(5,5,1,1).data;
  assert.ok(Math.abs(pixel[0]-pixel[1])<25,'Luminosity texture unexpectedly retained orange color');
  assert.equal(data.layers[1].blendMode,'luminosity');
  assert.equal(data.layers[2].shapeStyle.fillColor,undefined);
  assert.ok(data.layers[2].shapeStyle.strokeWidth>0);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
