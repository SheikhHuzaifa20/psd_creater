const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');

(async()=>{
 const root='http://localhost/psd_creater/public/';
 const parent=process.argv[2];
 if(!parent)throw new Error('Specify a writable test directory on the conversion drive.');
 const dir=fs.mkdtempSync(path.join(parent,'synthetic-large-test-'));
 try{
  const file=path.join(dir,'synthetic.psd');
  const fixture=spawnSync(process.execPath,[path.join(__dirname,'make_fixture.cjs'),file,'Synthetic Large Upload Test'],{encoding:'utf8'});
  assert.equal(fixture.status,0,fixture.stderr);
  // A valid tiny PSD with trailing padding tests the upload path without a huge rendered document.
  const sizeArg=process.argv.find(value=>value.startsWith('--size-mb='));
  const uploadMB=sizeArg?Number(sizeArg.split('=')[1]):256;
  assert.ok(Number.isInteger(uploadMB)&&uploadMB>=1&&uploadMB<=1024);
  fs.truncateSync(file,uploadMB*1024*1024);
  const page=await fetch(root); const html=await page.text();
  const token=html.match(/id="csrf_token"\s+value="([^"]+)"/)?.[1]; assert.ok(token);
  const cookie=page.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
  const boundary='----SyntheticPsdLargeUploadTest';
  const prefix=Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="use_ai"\r\n\r\n0\r\n--${boundary}\r\nContent-Disposition: form-data; name="psd_file"; filename="synthetic.psd"\r\nContent-Type: image/vnd.adobe.photoshop\r\n\r\n`);
  const suffix=Buffer.from(`\r\n--${boundary}--\r\n`);
  let result;
  if(process.argv.includes('--chunked')) {
   const id=require('node:crypto').randomBytes(16).toString('hex');
   const length=fs.statSync(file).size;
   const descriptor=fs.openSync(file,'r');
   let receipt;
   try {
    for(let offset=0,index=0;offset<length;offset+=8*1024*1024,index++){
     const bytes=Buffer.alloc(Math.min(8*1024*1024,length-offset));
     assert.equal(fs.readSync(descriptor,bytes,0,bytes.length,offset),bytes.length);
     const form=new FormData();form.append('upload_id',id);form.append('filename','synthetic.psd');form.append('file_size',String(length));form.append('chunk_index',String(index));form.append('chunk',new File([bytes],'chunk.bin'));
     const response=await fetch(new URL('upload-chunk',root),{method:'POST',headers:{'X-CSRF-TOKEN':token,'Cookie':cookie,'Accept':'application/json'},body:form});
     receipt=await response.json();assert.equal(response.status,200,JSON.stringify(receipt));assert.equal(receipt.success,true);
     if((index+1)%8===0)console.log('Uploaded '+Math.round((offset+bytes.length)/1024/1024)+' MB in chunks');
    }
   }finally{fs.closeSync(descriptor)}
   assert.equal(receipt.complete,true);
   const form=new FormData();form.append('use_ai','0');
   const response=await fetch(receipt.conversion_url,{method:'POST',headers:{'X-CSRF-TOKEN':token,'Cookie':cookie,'Accept':'application/json'},body:form,signal:AbortSignal.timeout(240000)});
   result={status:response.status,body:await response.text()};
  } else {
  result=await new Promise((resolve,reject)=>{
   const request=http.request(new URL('convert',root),{method:'POST',headers:{'Content-Type':`multipart/form-data; boundary=${boundary}`,'Content-Length':prefix.length+fs.statSync(file).size+suffix.length,'X-CSRF-TOKEN':token,'Cookie':cookie,'Accept':'application/json'}},response=>{
    let body=''; response.setEncoding('utf8');response.on('data',part=>body+=part);response.on('end',()=>resolve({status:response.statusCode,body}));
   });
   request.on('error',reject);request.setTimeout(180000,()=>request.destroy(new Error('Large upload timed out')));
   request.write(prefix);const input=fs.createReadStream(file);input.on('error',reject);input.on('end',()=>request.end(suffix));input.pipe(request,{end:false});
  });
  }
  let data;try{data=JSON.parse(result.body)}catch{}
  console.log(JSON.stringify({upload_mb:uploadMB,status:result.status,json:!!data,success:data?.success,message:data?.message}));
  assert.equal(result.status,200,'Large multipart upload returned HTTP '+result.status);
  assert.equal(data?.success,true,'Large PSD conversion failed');
  const download=await fetch(data.download_url);assert.equal(download.status,200);
  await download.arrayBuffer();console.log('Large upload conversion and ZIP download: PASS');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
})().catch(error=>{console.error(error.message);process.exitCode=1});
