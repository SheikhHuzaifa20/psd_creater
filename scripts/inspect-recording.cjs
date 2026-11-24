const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
 const root=path.resolve(__dirname,'..');const out=path.join(root,'storage/app/video-review');fs.mkdirSync(out,{recursive:true});
 const video=pathToFileURL(path.join(root,'bandicam 2026-11-24 21-28-30-114.mp4')).href;
 const html=path.join(out,'recording.html');fs.writeFileSync(html,'<!doctype html><body style="margin:0;background:black"><video controls style="width:100vw;height:100vh" src="'+video+'"></video>');
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:900}});await page.goto(pathToFileURL(html).href);
  await page.waitForFunction(()=>document.querySelector('video').readyState>=2);
  const duration=await page.evaluate(()=>document.querySelector('video').duration);
  console.log(JSON.stringify({duration}));
  for(const t of [0, .2,.4,.6,.8,.98].map(f=>Math.min(duration-.1,duration*f))){
   await page.evaluate(time=>new Promise(resolve=>{const v=document.querySelector('video');v.addEventListener('seeked',()=>resolve(),{once:true});v.currentTime=time||.01}),t);
   await page.locator('video').screenshot({path:path.join(out,'frame-'+Math.round(t)+'.png')});console.log('frame-'+Math.round(t)+'.png');
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e.message);process.exitCode=1});
