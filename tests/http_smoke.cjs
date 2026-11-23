const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const zlib = require('node:zlib');

(async () => {
 const root = process.argv[2] || 'http://localhost/psd_creater/public/';
 const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'psd-http-'));
 try {
  const file = path.join(temp, 'fixture.psd');
  const title = 'Synthetic Mountain Travel Test';
  const fixture = spawnSync(process.execPath, [path.join(__dirname,'make_fixture.cjs'), file, title], {encoding:'utf8'});
  assert.equal(fixture.status,0,fixture.stderr);
  const page = await fetch(root);
  assert.equal(page.status,200);
  const html = await page.text();
  const token = html.match(/id="csrf_token"\s+value="([^"]+)"/)?.[1];
  assert.ok(token,'CSRF token missing from upload page');
  const cookies = page.headers.getSetCookie().map(cookie=>cookie.split(';')[0]).join('; ');
  const headers = {'X-CSRF-TOKEN':token,'Cookie':cookies,'Accept':'application/json'};
  const bad = new FormData(); bad.append('psd_file', new File(['invalid'],'bad.psd'));
  const rejected = await fetch(new URL('convert', root), {method:'POST',headers,body:bad});
  assert.equal(rejected.status,422);
  const form = new FormData(); form.append('use_ai', process.argv.includes('--local') ? '0' : '1'); form.append('psd_file',new File([fs.readFileSync(file)],'synthetic.psd',{type:'image/vnd.adobe.photoshop'}));
  const response = await fetch(new URL('convert', root), {method:'POST',headers,body:form,signal:AbortSignal.timeout(240000)});
  const data = await response.json();
  assert.equal(response.status,200,JSON.stringify(data)); assert.equal(data.success,true);
  const download = await fetch(data.download_url,{headers:{Cookie:cookies}});
  assert.equal(download.status,200); const zip = Buffer.from(await download.arrayBuffer());
  const entries = new Map();
  const end = zip.lastIndexOf(Buffer.from([0x50,0x4b,0x05,0x06]));
  let offset = zip.readUInt32LE(end+16);
  while (zip.readUInt32LE(offset)===0x02014b50) {
   const size = zip.readUInt32LE(offset+20), method = zip.readUInt16LE(offset+10);
   const nameLen=zip.readUInt16LE(offset+28), extraLen=zip.readUInt16LE(offset+30), commentLen=zip.readUInt16LE(offset+32);
   const name=zip.subarray(offset+46,offset+46+nameLen).toString().replaceAll('\\','/');
   const local=zip.readUInt32LE(offset+42);
   const start=local+30+zip.readUInt16LE(local+26)+zip.readUInt16LE(local+28);
   const compressed=zip.subarray(start,start+size);
   entries.set(name,method===8?zlib.inflateRawSync(compressed):compressed);
   offset+=46+nameLen+extraLen+commentLen;
   if(offset>=end)break;
  }
  for(const entry of ['index.html','assets/css/style.css','assets/js/main.js','assets/css/bootstrap.min.css','assets/js/bootstrap.bundle.min.js','reference.html','README.txt'])assert.ok(entries.has(entry),entry+' missing');
  assert.ok(entries.get('index.html').toString().includes(title));
  assert.ok(entries.get('index.html').toString().includes('<h1'));
  console.log(JSON.stringify({page:200,invalid_upload:422,conversion:200,download:200,zip_entries:entries.size,log:data.logs}));
 } finally { fs.rmSync(temp,{recursive:true,force:true}); }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
