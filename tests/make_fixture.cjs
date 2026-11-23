const fs = require('fs');
const {writePsd} = require('ag-psd');
require('ag-psd/initialize-canvas');
fs.writeFileSync(process.argv[2], Buffer.from(writePsd({width:1200,height:800,children:[{name:'Hero section',children:[{name:'Heading',left:50,top:60,right:800,bottom:120,text:{text:process.argv[3],style:{font:{name:'ArialMT'},fontSize:48,fillColor:{r:10,g:20,b:30}}}},{name:'Description',left:50,top:150,right:800,bottom:200,text:{text:'Unique description for '+process.argv[3],style:{font:{name:'ArialMT'},fontSize:18}}}]}]})));
