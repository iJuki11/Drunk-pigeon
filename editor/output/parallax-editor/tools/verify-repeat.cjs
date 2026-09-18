const assert=require('assert'),{chromium}=require('playwright'),R=require('../source/runtime.js');
const L=4500,loop={start:0,end:L},chunks=[{x:0,width:4096,repeat:'loop'},{x:4096,width:404,repeat:'loop'}];
let checks=0;
// Cover the entire visible interval, including viewports wider than one period.
for(const speed of [0,.16,.34,.62,1])for(const viewport of [480,2172,9001])for(let lap=0;lap<=100;lap++)for(const phase of [0,.25,4095.5,4096,4499.75]){
 const camera=speed?(lap*L+phase)/speed:lap*L+phase,offset=camera*speed;
 const intervals=chunks.flatMap(o=>R.instances(o,loop,offset,offset+viewport).map(p=>[p.x-offset,p.x-offset+o.width])).sort((a,b)=>a[0]-b[0]);
 let covered=0;for(const [a,b] of intervals){if(b<=0)continue;assert(a<=covered+1e-6,`gap at speed=${speed}, lap=${lap}, phase=${phase}`);covered=Math.max(covered,b);}
 assert(covered>=viewport-1e-6);checks++;
}
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
 const page=await browser.newPage();await page.goto('file:///Users/Juki/Documents/Codex/Igra/output/parallax-editor/editor.html');await page.waitForFunction(()=>document.body.dataset.ready==='true');
 const pixels=await page.evaluate(()=>{
  const L=4500,images=new Map();for(const [id,width,color] of [['a',4096,'#ff0000'],['b',404,'#0000ff']]){const c=document.createElement('canvas');c.width=width;c.height=2;const cx=c.getContext('2d');cx.fillStyle=color;cx.fillRect(0,0,width,2);images.set(id,c);}
  const objects=[{id:'a',assetId:'a',x:0,width:4096},{id:'b',assetId:'b',x:4096,width:404}].map(o=>({...o,y:0,height:2,opacity:1,repeat:'loop'}));
  const scene={canvas:{width:480,height:2},loop:{start:0,end:L},layers:[{id:'test',opacity:1,parallax:1,objects}]};
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');canvas.height=2;let count=0;
  for(const speed of [0,.16,.34,.62,1])for(const viewport of [480,9500]){
   canvas.width=viewport;scene.layers[0].parallax=speed;
   for(const lap of [0,1,2,10,100])for(const phase of [0,4095,4096,4499]){
    const camera=speed?(lap*L+phase)/speed:lap*L+phase;
    ParallaxRuntime.render(ctx,scene,images,camera,{width:viewport,height:2,viewportWidth:viewport});
    const data=ctx.getImageData(0,0,viewport,1).data;
    for(let i=3;i<data.length;i+=4)if(data[i]<250)throw Error('Uncovered pixel at '+JSON.stringify({speed,viewport,lap,phase,x:(i-3)/4,alpha:data[i]}));
    count++;
   }
  }
  return count;
 });
 console.log(`PASS: ${checks} full-coverage geometry checks through 100 laps; ${pixels} Canvas renders with no transparent gaps, including 4096/404 split and wide viewports.`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
