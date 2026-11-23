const vm = require('node:vm');
(async()=>{
 const response=await fetch('http://localhost/psd_creater/public/');
 if(response.status!==200)throw new Error('Upload page returned '+response.status);
 const html=await response.text();let count=0;
 for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)){
  if(match[1].trim()){new vm.Script(match[1]);count++;}
 }
 if(!html.includes('upload-chunk'))throw new Error('Chunked upload UI was not rendered');
 console.log('Rendered upload JavaScript syntax: PASS ('+count+' inline scripts)');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
