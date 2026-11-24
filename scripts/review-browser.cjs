const {chromium}=require('playwright');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const dir=process.argv[2];
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  await page.goto(pathToFileURL(path.join(dir,'index.html')).href);
  await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.locator('[style],style').count(),0,'Authored inline CSS remains');
  await page.screenshot({path:path.join(dir,'top.png')});
  await page.screenshot({path:path.join(dir,process.argv[3]||'review.png'),fullPage:true});
  const sections=await page.locator('section').evaluateAll(nodes=>nodes.map(n=>({id:n.id,top:Math.round(n.offsetTop),height:Math.round(n.offsetHeight)})));
  for(const field of await page.locator('input,textarea').all()) {
   const type=await field.getAttribute('type');
   await field.scrollIntoViewIfNeeded();await field.click();await field.fill(type==='email'?'test@example.com':'Test field');
   assert.ok((await field.inputValue()).length>0,'Field is not editable');
  }
  const contact=page.locator('section.contact');
  if(await contact.count())await contact.screenshot({path:path.join(dir,'contact.png')});
  const metrics=await page.evaluate(()=>({h1:document.querySelectorAll('h1').length,inputs:document.querySelectorAll('input,textarea').length,scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth,fonts:[...document.fonts].map(f=>({family:f.family,status:f.status})),coordinateGrid:document.querySelectorAll('.psd-grid').length,inlineCss:document.querySelectorAll('style').length+[...document.querySelectorAll('[style]')].filter(n=>n.getAttribute('style').trim()).length}));
  assert.equal(metrics.scrollWidth,metrics.viewport,'Desktop horizontal overflow');
  assert.equal(metrics.h1,1);
  const minimum=Number(process.argv.find(arg=>arg.startsWith('--min-fields='))?.split('=')[1]||5);
  assert.ok(metrics.inputs>=minimum,'Expected PSD form fields missing');
  assert.equal(metrics.coordinateGrid,0);
  assert.equal(metrics.inlineCss,0,'Inline CSS remains in the rendered export');
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(dir,'mobile.png'),fullPage:true});
  const mobile=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(mobile.scroll<=mobile.width+1,'Mobile horizontal overflow');
  console.log(JSON.stringify({sections,metrics,mobile,editable_fields:'PASS'}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e.message);process.exitCode=1});
