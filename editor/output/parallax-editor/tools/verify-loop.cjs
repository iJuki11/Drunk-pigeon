const {chromium}=require('playwright'),assert=require('assert'),fs=require('fs');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('file:///Users/Juki/Documents/Codex/Igra/output/parallax-editor/editor.html');
 await page.waitForFunction(()=>document.body.dataset.ready==='true');
 const input=await page.evaluate(()=>{
  const p=ScenaEditor.exportData();
  p.assets=['red','blue','lime','yellow'].map(color=>{const c=document.createElement('canvas');c.width=c.height=10;const cx=c.getContext('2d');cx.fillStyle=color;cx.fillRect(0,0,10,10);return {id:color,name:color,width:10,height:10,data:c.toDataURL()};});
  const obj=(id,assetId,x,width,opacity=1)=>({id,name:id,assetId,x,y:0,width,height:128,opacity,visible:true,repeat:'loop'});
  p.scene={name:'Test crop',canvas:{width:480,height:128},groundY:120,loop:{start:500,end:5000},layers:[
   {id:'base',name:'Base',visible:true,opacity:.5,parallax:1,objects:[obj('left','red',450,100),obj('right','blue',4950,100,.5),obj('outside','lime',5100,100)]},
   {id:'front',name:'Front',visible:true,opacity:.7,parallax:.34,objects:[obj('chunk-edge','yellow',4590,20)]},
   {id:'hidden',name:'Hidden',visible:false,opacity:1,parallax:.8,objects:[obj('hidden-object','lime',500,4500)]}
  ]};return p;
 });
 await page.locator('#projectFile').setInputFiles({name:'crop-input.parallax.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(input))});
 await page.waitForFunction(()=>ScenaEditor.getScene().name==='Test crop');
 const before=await page.evaluate(()=>ScenaEditor.getScene());
 await page.getByRole('button',{name:'Petlja',exact:true}).click();
 const wait=page.waitForEvent('download');await page.locator('#exportLoop').click();const download=await wait;
 await download.saveAs('/private/tmp/test-loop-export.parallax.json');
 const output=JSON.parse(fs.readFileSync('/private/tmp/test-loop-export.parallax.json'));
 assert.equal(output.exportMode,'loop-only');assert.deepEqual(output.sourceRegion,{start:500,end:5000});
 assert.deepEqual(output.scene.loop,{start:0,end:4500});assert.equal(output.scene.canvas.width,480);
 assert.equal(output.scene.layers.length,2);assert.equal(output.assets.length,4);
 assert.deepEqual(output.scene.layers.map(l=>[l.opacity,l.parallax]),[[.5,1],[.7,.34]]);
 assert.deepEqual(output.scene.layers[0].objects.map(o=>[o.x,o.width,o.repeat]),[[0,4096,'loop'],[4096,404,'loop']]);
 assert.deepEqual(await page.evaluate(()=>ScenaEditor.getScene()),before,'export does not mutate working scene');
 const pixels=await page.evaluate(async output=>{
  const samples=[];
  for(const a of output.assets){const im=new Image();im.src=a.data;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const cx=c.getContext('2d');cx.drawImage(im,0,0);const at=x=>Array.from(cx.getImageData(x,20,1,1).data);samples.push({first:at(0),last:at(c.width-1),mid:at(100)});}
  return samples;
 },output);
 assert.deepEqual(pixels[0].first,[255,0,0,255]);assert.deepEqual(pixels[0].mid,[0,0,0,0]);
 assert.deepEqual(pixels[1].last,[0,0,255,128]);assert.deepEqual(pixels[1].first,[0,0,0,0]);
 assert.deepEqual(pixels[2].last,[255,255,0,255]);assert.deepEqual(pixels[3].first,[255,255,0,255]);
 await page.locator('#projectFile').setInputFiles('/private/tmp/test-loop-export.parallax.json');
 await page.waitForFunction(()=>ScenaEditor.getScene().loop.start===0);
 const repeated=await page.evaluate(async()=>{
  const p=ScenaEditor.exportData(),imgs=new Map();await Promise.all(p.assets.map(async a=>{const im=new Image();im.src=a.data;await im.decode();imgs.set(a.id,im);}));
  const c=document.createElement('canvas');c.width=480;c.height=128;const ctx=c.getContext('2d');
  ParallaxRuntime.render(ctx,p.scene,imgs,0,{onlyLayer:'base'});const a=c.toDataURL();
  ParallaxRuntime.render(ctx,p.scene,imgs,4500,{onlyLayer:'base'});return a===c.toDataURL();
 });
 assert(repeated,'layer repeats exactly after its 4500 px period');assert.deepEqual(errors,[]);
 console.log('PASS: exact crop, outside/hidden exclusion, alpha, chunk boundary, parallax, unchanged source, reimport, repeated period.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
