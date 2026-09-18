const {chromium}=require('playwright'),assert=require('assert');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();await page.goto('file:///Users/Juki/Documents/Codex/Igra/output/parallax-editor/editor.html');await page.waitForFunction(()=>document.body.dataset.ready==='true');
  const result=await page.evaluate(()=>{
   const W=960,H=724,G=680,L=4500,images=new Map();
   for(const [id,w] of [['a',4096],['b',404]]){const c=document.createElement('canvas');c.width=w;c.height=H;const cx=c.getContext('2d');cx.fillStyle='#abcdef';cx.fillRect(0,0,w,H);if(id==='a'){cx.fillStyle='#ff0000';cx.fillRect(100,495,100,100);}images.set(id,c);}
   const scene={canvas:{width:W,height:H},groundY:595,loop:{start:0,end:L},layers:[{id:'test',opacity:1,parallax:1,objects:[{assetId:'a',x:0,width:4096},{assetId:'b',x:4096,width:404}].map(o=>({...o,y:0,height:H,opacity:1,repeat:'loop'}))}]};
   const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d');
   const rows=[];let coverage=0;
   for(const zoom of [1,.75,.5,.2]){
    const draw=(camera,broken=false)=>{ctx.clearRect(0,0,W,H);ctx.save();if(broken){ctx.translate(0,G);ctx.scale(zoom,zoom);ctx.translate(0,-G);ParallaxRuntime.render(ctx,scene,images,camera,{width:W/zoom,height:H/zoom,viewportWidth:W});}else{ctx.translate(0,G-scene.groundY*zoom);ParallaxRuntime.render(ctx,scene,images,camera,{width:W,height:H*zoom,viewportWidth:W/zoom,clear:false});}ctx.restore();};
    scene.layers[0].parallax=1;draw(0);
    const pixels=ctx.getImageData(0,0,W,H).data;let x0=W,x1=-1,y0=H,y1=-1;
    // Inspect the first marker, not a repeated copy at small zoom.
    for(let y=0;y<H;y++)for(let x=0;x<Math.ceil(300*zoom);x++){const i=(y*W+x)*4;if(pixels[i]>250&&pixels[i+1]<5&&pixels[i+2]<5&&pixels[i+3]>250){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}}
    rows.push({zoom,width:x1-x0+1,height:y1-y0+1,bottom:y1+1});
    for(const speed of [0,.16,.34,.62,1]){scene.layers[0].parallax=speed;for(const lap of [0,1,3,100])for(const phase of [0,4095,4499]){draw(speed?(lap*L+phase)/speed:0);const p=ctx.getImageData(0,G-2,W,1).data;for(let i=3;i<p.length;i+=4)if(p[i]===0)throw Error('Blank gap '+JSON.stringify({zoom,speed,lap,phase,x:(i-3)/4}));coverage++;}}
   }
   // Complementary sparse layers form a solid strip only at initial alignment.
   const part=(x,width)=>({x,width,repeat:'loop'}),loop={start:0,end:1000};
   const sparseGap=camera=>{const spans=[[part(0,500),1],[part(500,500),.8]].flatMap(([o,p])=>ParallaxRuntime.instances(o,loop,camera*p,camera*p+1000).map(i=>[Math.max(0,i.x-camera*p),Math.min(1000,i.x-camera*p+o.width)])).sort((a,b)=>a[0]-b[0]);let end=0,gaps=0;for(const [a,b] of spans){if(a>end)gaps+=a-end;end=Math.max(end,b);}return gaps+Math.max(0,1000-end);};
   return {rows,coverage,sparseGaps:[0,1000,2000].map(camera=>({camera,gap:sparseGap(camera)}))};
  });
  for(const r of result.rows){assert.equal(r.width,100*r.zoom);assert.equal(r.height,100*r.zoom);assert.equal(r.bottom,680);}
  assert.equal(result.sparseGaps[0].gap,0);assert(result.sparseGaps[1].gap>0);assert(result.sparseGaps[2].gap>result.sparseGaps[1].gap);
  console.log(JSON.stringify(result,null,2));
  console.log('PASS: rendered zoom dimensions and ground anchor, no blank repeat gaps at four zooms; reproduced growing gaps from complementary layers at different speeds.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
