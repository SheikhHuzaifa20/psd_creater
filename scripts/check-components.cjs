const {chromium}=require('playwright');
const {pathToFileURL}=require('node:url');const path=require('node:path');const assert=require('node:assert/strict');
(async()=>{const dir=process.argv[2];const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
 const p=await b.newPage({viewport:{width:1440,height:1000}});await p.goto(pathToFileURL(path.join(dir,'index.html')).href);await p.evaluate(()=>document.fonts.ready);
 const result=await p.evaluate(()=>({bannerColor:getComputedStyle(document.querySelector('section.banner')).backgroundColor,coveredLogo:document.querySelectorAll('img[alt="Layer 4"]').length,cards:[...document.querySelectorAll('.service-card')].map(c=>({title:c.querySelector('h1,h2,h3')?.textContent.replace(/\s+/g,' ').trim(),top:Math.round(c.getBoundingClientRect().top),left:Math.round(c.getBoundingClientRect().left),bg:getComputedStyle(c).backgroundColor,gradient:getComputedStyle(c).backgroundImage})),testimonialCards:document.querySelectorAll('.testimonial-card').length,ratingRows:[...document.querySelectorAll('.testimonial-card .icon-row')].map(n=>n.querySelectorAll('img').length),contactFields:[...document.querySelectorAll('section.contact input,section.contact textarea')].map(n=>n.name),h1:document.querySelector('h1')?.textContent.replace(/\s+/g,' ').trim()}));
 console.log(JSON.stringify(result));
 if(process.argv.includes('--assert-editing')){
  assert.ok(result.bannerColor.match(/\d+/g).slice(0,3).every(n=>Number(n)>=240),'The light PSD hero became dark');
  assert.equal(result.coveredLogo,0,'Covered logo leaked into the hero');assert.equal(result.cards.length,4);
  const line=result.cards.find(c=>c.title==='Line Editing'),copy=result.cards.find(c=>c.title==='Copy Editing');
  assert.ok(line&&copy&&Math.abs(line.top-copy.top)<20&&line.left<copy.left,'Service cards lost their source two-column layout');
  assert.equal(result.testimonialCards,4);assert.ok(result.ratingRows.filter(n=>n===3).length>=4,'Stars detached from testimonial cards');
  assert.deepEqual(result.contactFields.sort(),['email','message','name','subject']);assert.ok(result.h1.includes('Book Editing Services'));
  console.log('Recording PSD visual structure regression: PASS');
 }
 if(!process.argv.includes('--no-screenshot')){const section=p.locator('section').filter({hasText:'Line'}).first();if(await section.count())await section.screenshot({path:path.join(dir,'cards.png')});}
}finally{await b.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
