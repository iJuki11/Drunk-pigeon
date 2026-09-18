const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert');
const root='/Users/Juki/Documents/Codex/project',out=__dirname;
const project=JSON.parse(fs.readFileSync(root+'/assets/backgrounds/background.parallax.json','utf8'));
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
 const page=await browser.newPage({viewport:{width:430,height:844}}),errors=[],requests=[];
 await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url());if(u.hostname!=='game.test')return route.abort();
  const name=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));
  if(!name.startsWith(root+'/'))return route.abort();
  try{let data=fs.readFileSync(name);if(name.endsWith('/src/main.js'))data=Buffer.from(data.toString()+'\nwindow.auditGame = game;');
   const types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png'};
   await route.fulfill({status:200,contentType:types[path.extname(name)]||'application/octet-stream',body:data});
  }catch(e){requests.push({path:u.pathname,error:e.code});await route.fulfill({status:404,body:'Not found'});}
 });
 await page.goto('http://game.test/');await page.waitForFunction(()=>window.auditGame?.parallaxProject&&window.auditGame.assets.cache.size===3,null,{polling:100});
 const result=await page.evaluate(async()=>{
  const g=window.auditGame,p=g.parallaxProject,R=ParallaxRuntime,s=p.scene,L=s.loop.end-s.loop.start;
  const c=document.createElement('canvas');c.width=L;c.height=s.canvas.height;const cx=c.getContext('2d',{willReadFrequently:true});
  const foreground=s.layers.filter(l=>/ograda|živica|zivica/i.test(l.name)||l.id==='cafe');
  const runs=mask=>{const a=[];let start=-1;for(let x=0;x<=mask.length;x++){if(x<mask.length&&mask[x]&&start<0)start=x;if((x===mask.length||!mask[x])&&start>=0){a.push([start,x]);start=-1;}}return a;};
  const draw=(scene,camera)=>{cx.clearRect(0,0,L,c.height);R.render(cx,scene,g.parallaxImages,camera,{width:L,height:c.height,viewportWidth:L});};
  const coverage=()=>{const row=cx.getImageData(0,585,L,1).data,missing=Array.from({length:L},(_,x)=>row[x*4+3]<32);const intervals=runs(missing);return {missing:missing.filter(Boolean).length,longest:Math.max(0,...intervals.map(([a,b])=>b-a)),intervals};};
  const layerCoverage=[];
  for(const l of s.layers){draw({...s,layers:[l]},0);const px=cx.getImageData(0,0,L,c.height).data;let count=0;for(let i=3;i<px.length;i+=4)if(px[i]>32)count++;layerCoverage.push({id:l.id,name:l.name,parallax:l.parallax,nontransparent:count,...coverage()});}
  const samples=[],captures=[];
  for(const camera of [0,4500,9000,13500,18000]){
   draw({...s,layers:foreground},camera);samples.push({camera,...coverage()});
   draw(s,camera);captures.push({name:'scene-'+camera+'.png',image:c.toDataURL()});
  }
  // One phase for all physical foreground pieces: controlled comparison only.
  const aligned={...s,layers:s.layers.map(l=>foreground.includes(l)?{...l,parallax:.78}:l)};
  draw(aligned,13500);captures.push({name:'scene-13500-aligned-fences.png',image:c.toDataURL()});
  const alignedCoverage=[];
  for(const camera of [0,4500,9000,13500,18000]){draw({...aligned,layers:aligned.layers.filter(l=>foreground.some(f=>f.id===l.id))},camera);alignedCoverage.push({camera,...coverage()});}
  // Same layer, same phase, after 1/3/100 cycles must return the same pixels.
  let repeatChecks=0;
  for(const l of s.layers){draw({...s,layers:[l]},0);const before=c.toDataURL();for(const lap of [1,3,100]){draw({...s,layers:[l]},l.parallax?lap*L/l.parallax:lap*L);if(before!==c.toDataURL())throw Error('Layer changed after full cycle: '+l.name+' '+lap);repeatChecks++;}}
  // Capture the actual Game.draw path at the current zoom without changing files.
  g.ui.showPlaying();g.state='paused';g.worldX=13500;g.draw();captures.push({name:'game-current-camera-13500.png',image:g.canvas.toDataURL()});
  // Current integration maps scene ground to gameplay ground and uses one scale.
  const recorded=[],original=R.render;R.render=(context,scene,images,camera,options)=>{recorded.push({options,transform:context.getTransform().toJSON(),ground:g.getGroundY(),screen:{width:g.width,height:g.height}});return original(context,scene,images,camera,options);};g.draw();R.render=original;
  const {ToniManager}=await import('/src/enemies.js');
  const tracking=[];for(const fps of [30,60,120]){const t=new ToniManager({}, {playShot(){}}, {takeDamage(){}});t.toni={x:350,y:0,phase:'prepare',elapsed:0,cycles:0,maxCycles:3};for(let i=0;i<fps/30;i++)t.update(1/fps,430,844,{x:50,y:600});tracking.push({fps,elapsed:1/30,y:t.toni.y});}
  // Pause-resize test with exact same dimensions: position should not teleport.
  g.player.x=123;g.player.y=200;g.state='paused';g.resize();const pauseResize={before:{x:123,y:200},after:{x:g.player.x,y:g.player.y}};
  return {scene:{...s,layers:s.layers.map(({objects,...l})=>({...l,objects:objects.length}))},layerCoverage,foregroundIds:foreground.map(l=>l.id),samples,alignedCoverage,repeatChecks,recorded,tracking,pauseResize,captures,assetsLoaded:g.parallaxImages.size,customAssets:[...g.assets.cache].map(([id,im])=>({id,width:im.naturalWidth,height:im.naturalHeight}))};
 });
 for(const cap of result.captures)fs.writeFileSync(path.join(out,cap.name),Buffer.from(cap.image.split(',')[1],'base64'));
 delete result.captures;result.pageErrors=errors;result.failedRequests=requests;
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify({repeatChecks:result.repeatChecks,assetsLoaded:result.assetsLoaded,customAssets:result.customAssets,layerCoverage:result.layerCoverage.map(({name,parallax,nontransparent,missing,longest})=>({name,parallax,nontransparent,missing,longest})),samples:result.samples,alignedCoverage:result.alignedCoverage,tracking:result.tracking,pauseResize:result.pauseResize,pageErrors:errors,failedRequests:requests},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
