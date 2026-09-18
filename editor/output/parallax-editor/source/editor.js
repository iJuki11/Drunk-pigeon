(function(){
'use strict';
const B=JSON.parse(document.getElementById('bundle').textContent),R=ParallaxRuntime,$=id=>document.getElementById(id),clone=v=>JSON.parse(JSON.stringify(v));
const catalog=new Map(B.assets.map(a=>[a.id,a])),images=new Map(),masks=new Map(),customAssets=new Map();
let scene=clone(B.scene),activeLayer=scene.layers.find(l=>l.id==='cafe')?.id||scene.layers.find(l=>!l.locked)?.id||scene.layers[0].id,selection=null,tab='object',undo=[],redo=[],ready=false,drag=null,space=false;
const view={mode:'edit',zoom:1,panX:0,panY:0,camera:0,speed:160,playing:false,grid:false,snap:false,isolate:false,guides:true};
let transform={s:1,tx:0,ty:0},cssW=1,cssH=1,db=null,autosaveTimer=null,toastTimer=null,saveRevision=0;
const canvas=$('canvas'),ctx=canvas.getContext('2d');
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v)),round=n=>Math.round(n*100)/100,id=()=>crypto.randomUUID?crypto.randomUUID():'id-'+Date.now()+'-'+Math.random().toString(36).slice(2);
function layer(){return scene.layers.find(l=>l.id===activeLayer)||scene.layers[0];}
function selected(){for(const l of scene.layers){const o=l.objects.find(o=>o.id===selection);if(o)return {l,o};}return null;}
function say(s){$('toast').textContent=s;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3800);}
function countObjects(){return scene.layers.reduce((n,l)=>n+l.objects.length,0);}
function setTab(t){tab=t;document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));['object','layer','loop'].forEach(n=>$(n+'Panel').hidden=n!==t);}
function record(before){const after=JSON.stringify(scene);if(before===after)return;undo.push(before);if(undo.length>60)undo.shift();redo=[];scheduleSave();}
function commit(fn){const before=JSON.stringify(scene);fn();record(before);refresh();}
function history(back=true){const from=back?undo:redo,to=back?redo:undo;if(!from.length)return;to.push(JSON.stringify(scene));scene=JSON.parse(from.pop());selection=null;if(!scene.layers.some(l=>l.id===activeLayer))activeLayer=scene.layers.at(-1).id;scheduleSave();refresh();}
async function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open('scena-parallax-editor',1);req.onupgradeneeded=()=>req.result.createObjectStore('projects');req.onerror=()=>reject(req.error);req.onsuccess=()=>resolve(req.result);});}
async function loadSaved(){if(!db)return null;return new Promise(resolve=>{const req=db.transaction('projects').objectStore('projects').get('current-v1');req.onsuccess=()=>resolve(req.result);req.onerror=()=>resolve(null);});}
function scheduleSave(){clearTimeout(autosaveTimer);$('saveState').textContent='Promjene u sceni…';const revision=++saveRevision;autosaveTimer=setTimeout(()=>saveLocal(revision),450);}
async function saveLocal(revision){
 if(!db){$('saveState').textContent='Za trajnu kopiju preuzmi projekt';return;}
 try{const tx=db.transaction('projects','readwrite');tx.objectStore('projects').put({scene:clone(scene),assets:[...customAssets.values()]},'current-v1');tx.oncomplete=()=>{if(revision===saveRevision)$('saveState').textContent='✓ Spremljeno u ovom pregledniku';};tx.onerror=()=>{$('saveState').textContent='Preuzmi projekt za sigurnu kopiju';};}catch(e){$('saveState').textContent='Preuzmi projekt za sigurnu kopiju';}
}
async function loadAsset(a){
 if(images.has(a.id))return;
 const img=new Image();img.src=a.data;await img.decode();if(img.naturalWidth>16384||img.naturalHeight>16384||img.naturalWidth*img.naturalHeight>50000000)throw Error('Slika je prevelika za editor.');images.set(a.id,img);
 const scale=Math.min(1,256/Math.max(img.width,img.height)),w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale)),c=document.createElement('canvas');c.width=w;c.height=h;
 const cx=c.getContext('2d',{willReadFrequently:true});cx.drawImage(img,0,0,w,h);masks.set(a.id,{data:cx.getImageData(0,0,w,h).data,w,h});
}
function editable(){const s=selected();if(!s)return null;if(s.l.locked){say('Sloj je zaključan. Otključaj ga u postavkama sloja.');return null;}return s;}
function activeEditable(){const l=layer();if(l.locked){say('Aktivni sloj je zaključan. Otključaj ga ili odaberi drugi sloj.');return null;}return l;}
function selectObject(objectId,layerId){selection=objectId;activeLayer=layerId;setTab('object');refresh();}
function makeObject(a,x,y){const w=a.defaultWidth||Math.min(a.width,300),h=a.defaultHeight||w*a.height/a.width;return {id:id(),name:a.name,assetId:a.id,x:round(x),y:round(y),width:round(w),height:round(h),opacity:1,flipX:false,flipY:false,repeat:'auto',visible:true};}
function addAsset(assetId,point){const a=catalog.get(assetId),l=activeEditable();if(!a||!l||!ready)return;if(countObjects()>=2000){say('Dosegnuto je 2000 elemenata.');return;}
 const x=point?point.x:scene.loop.start+(scene.loop.end-scene.loop.start)/2-(a.defaultWidth||300)/2;
 const h=a.defaultHeight||(a.defaultWidth||Math.min(a.width,300))*a.height/a.width;
 const y=point?point.y:(a.defaultY??scene.groundY-h);
 commit(()=>{const o=makeObject(a,x,y);l.objects.push(o);selection=o.id;});setTab('object');refresh();}
function renderLibrary(){
 const q=$('assetSearch').value.toLocaleLowerCase(),cat=$('assetCategory').value;const list=$('assetList');list.replaceChildren();
 for(const a of catalog.values()){
  if(cat&&a.category!==cat||q&&!a.name.toLocaleLowerCase().includes(q))continue;
  const btn=document.createElement('button');btn.className='asset';btn.draggable=true;btn.title=`${a.name} · ${a.width} × ${a.height} px`;btn.setAttribute('aria-label','Dodaj '+a.name);btn.dataset.assetId=a.id;
  const img=document.createElement('img');img.src=a.data;img.loading='lazy';img.alt='';const text=document.createElement('span');text.textContent=a.name;btn.append(img,text);btn.onclick=()=>addAsset(a.id);
  btn.ondragstart=e=>{e.dataTransfer.setData('application/x-scena-asset',a.id);e.dataTransfer.effectAllowed='copy';};list.append(btn);
 }
}
function categories(){const previous=$('assetCategory').value;$('assetCategory').replaceChildren(new Option('Svi elementi',''));for(const category of new Set([...catalog.values()].map(a=>a.category)))$('assetCategory').add(new Option(category,category));$('assetCategory').value=previous;}
function renderLayers(){
 $('layerCount').textContent=scene.layers.length;$('layerList').replaceChildren();
 for(const l of [...scene.layers].reverse()){
  const row=document.createElement('div');row.className='layer-row'+(l.id===activeLayer?' active':'')+(l.visible===false?' dim':'');row.dataset.layerId=l.id;row.tabIndex=0;
  const eye=document.createElement('button');eye.textContent=l.visible===false?'○':'●';eye.title=l.visible===false?'Prikaži sloj':'Sakrij sloj';eye.setAttribute('aria-label',eye.title+' '+l.name);eye.onclick=e=>{e.stopPropagation();commit(()=>l.visible=!l.visible);};
  const name=document.createElement('span');name.textContent=l.name;name.title=l.name;
  const speed=document.createElement('small');speed.textContent=l.parallax.toFixed(2);
  const lock=document.createElement('button');lock.textContent=l.locked?'▣':'◇';lock.title=l.locked?'Otključaj sloj':'Zaključaj sloj';lock.setAttribute('aria-label',lock.title+' '+l.name);lock.onclick=e=>{e.stopPropagation();commit(()=>l.locked=!l.locked);};
  row.append(eye,name,speed,lock);row.onclick=()=>{activeLayer=l.id;selection=null;refresh();setTab('layer');};row.onkeydown=e=>{if(e.key==='Enter')row.click();};$('layerList').append(row);
 }
}
function setValue(name,value){if(document.activeElement!==$(name))$(name).value=value;}
function inspector(){
 const s=selected(),l=layer();$('objectControls').hidden=!s;$('noSelection').hidden=!!s;
 if(s){
  const o=s.o;for(const [name,key] of [['objectName','name'],['objectX','x'],['objectY','y'],['objectWidth','width'],['objectHeight','height'],['objectOpacity','opacity'],['objectRepeat','repeat']])setValue(name,typeof o[key]==='number'?round(o[key]):o[key]);
  $('objectOpacityValue').value=Math.round(o.opacity*100)+'%';$('flipX').classList.toggle('primary',o.flipX);
  $('objectLayer').replaceChildren(...scene.layers.map(l=>new Option(l.name,l.id)));$('objectLayer').value=s.l.id;
  $('objectInfo').textContent=(s.l.locked?'Zaključan sloj · ':'')+(catalog.get(o.assetId)?.width||'?')+' × '+(catalog.get(o.assetId)?.height||'?')+' px izvor · '+(R.repeats(o,scene.loop)?'ponavlja se':'jednom / uvod');
  $('selectionStatus').textContent=o.name+' · X '+round(o.x)+' / Y '+round(o.y)+' · '+round(o.width)+' × '+round(o.height);
 }else $('selectionStatus').textContent=l.name+' · '+l.objects.length+' elemenata'+(l.locked?' · zaključan':'');
 $('objectList').replaceChildren();for(const o of [...l.objects].reverse()){const b=document.createElement('button');b.textContent=o.name;b.classList.toggle('active',o.id===selection);b.onclick=()=>selectObject(o.id,l.id);$('objectList').append(b);}
 setValue('layerName',l.name);setValue('layerSpeed',l.parallax);setValue('layerSpeedRange',l.parallax);setValue('layerOpacity',l.opacity);$('layerOpacityValue').value=Math.round(l.opacity*100)+'%';$('layerVisible').checked=l.visible;$('layerLocked').checked=l.locked;
 setValue('loopStart',scene.loop.start);setValue('loopEnd',scene.loop.end);setValue('loopLength',scene.loop.end-scene.loop.start);setValue('viewportWidth',scene.canvas.width);setValue('sceneHeight',scene.canvas.height);setValue('groundY',scene.groundY);
 $('loopSummary').textContent=`Petlja ${scene.loop.start} → ${scene.loop.end} px · duljina ${scene.loop.end-scene.loop.start}`;
 const surfaces=scene.layers.flatMap(l=>l.objects.filter(o=>o.surface&&!o.surfaceIntroFor)),gaps=surfaces.some(o=>o.x!==scene.loop.start||o.width!==scene.loop.end-scene.loop.start||!R.repeats(o,scene.loop));
 $('surfaceStatus').textContent=gaps?'Podloge ne pokrivaju novi segment. Gumb prilagođava nebo, udaljeni grad i cestu, uključujući uvod.':'Podloge odgovaraju petlji. Kuće i ostale elemente slažeš ručno.';
 $('fitSurfaces').disabled=!surfaces.length;
 setValue('projectName',scene.name);$('undo').disabled=!undo.length;$('redo').disabled=!redo.length;
 $('deleteLayer').disabled=scene.layers.length<=1;$('layerForward').disabled=scene.layers.indexOf(l)===scene.layers.length-1;$('layerBackward').disabled=scene.layers.indexOf(l)===0;
 $('emptyHint').hidden=countObjects()>0;$('camera').max=Math.max(scene.loop.end+3*(scene.loop.end-scene.loop.start),view.camera+scene.canvas.width);
}
function refresh(){renderLayers();inspector();draw();}
function getTransform(){const baseWidth=view.mode==='edit'?Math.max(scene.loop.end,scene.canvas.width):scene.canvas.width;
 const fit=Math.min((cssW-60)/baseWidth,(cssH-65)/scene.canvas.height),s=Math.max(.003,fit)*view.zoom;
 let tx=(cssW-baseWidth*s)/2-view.panX*s,ty=(cssH-scene.canvas.height*s)/2-view.panY*s;
 if(view.mode==='seam')tx=cssW/2-scene.loop.end*s-view.panX*s;
 return {s,tx,ty};
}
function worldPoint(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left-transform.tx)/transform.s,y:(e.clientY-r.top-transform.ty)/transform.s};}
function checkBackground(x,y,w,h){const tile=24/transform.s;ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.fillStyle='#667777';ctx.fillRect(x,y,w,h);ctx.fillStyle='#718280';for(let iy=Math.floor(y/tile);iy<(y+h)/tile;iy++)for(let ix=Math.floor(x/tile);ix<(x+w)/tile;ix++)if((ix+iy)%2===0)ctx.fillRect(ix*tile,iy*tile,tile,tile);ctx.restore();}
function displayCopies(o){if(view.mode==='edit')return [{x:o.x,copy:0,clipLeft:null}];const min=-transform.tx/transform.s,max=(cssW-transform.tx)/transform.s;return R.instances(o,scene.loop,min,max);}
function draw(){if(!ready)return;
 transform=getTransform();const dpr=Math.min(devicePixelRatio||1,2);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,cssW,cssH);
 ctx.save();ctx.translate(transform.tx,transform.ty);ctx.scale(transform.s,transform.s);
 const min=-transform.tx/transform.s,max=(cssW-transform.tx)/transform.s;
 if(view.mode==='play'){
  checkBackground(0,0,scene.canvas.width,scene.canvas.height);R.render(ctx,scene,images,view.camera,{clear:false});
 }else{
  const x=view.mode==='seam'?min:0,w=view.mode==='seam'?max-min:Math.max(scene.loop.end,scene.canvas.width);ctx.save();ctx.beginPath();ctx.rect(x,0,w,scene.canvas.height);ctx.clip();checkBackground(x,0,w,scene.canvas.height);
  if(view.mode==='seam'){
   ctx.save();ctx.translate(min,0);R.render(ctx,scene,images,0,{width:max-min,height:scene.canvas.height,viewportWidth:max-min,designOffset:min,clear:false,onlyLayer:view.isolate?activeLayer:null});ctx.restore();
  }else{
   for(const l of scene.layers){if(!l.visible)continue;ctx.save();ctx.globalAlpha=l.opacity;for(const o of l.objects){if(o.visible!==false&&images.has(o.assetId))R.paint(ctx,images.get(o.assetId),o,o.x);}ctx.restore();}
  }ctx.restore();
  if(view.grid){ctx.save();ctx.strokeStyle='#e2f6d223';ctx.lineWidth=1/transform.s;const step=50;ctx.beginPath();for(let x=Math.floor(min/step)*step;x<max;x+=step){ctx.moveTo(x,0);ctx.lineTo(x,scene.canvas.height);}for(let y=0;y<=scene.canvas.height;y+=step){ctx.moveTo(min,y);ctx.lineTo(max,y);}ctx.stroke();ctx.restore();}
  if(view.guides){
   ctx.lineWidth=1.2/transform.s;ctx.setLineDash([6/transform.s,5/transform.s]);ctx.strokeStyle='#d1efaa';
   for(const x of [scene.loop.start,scene.loop.end]){ctx.beginPath();ctx.moveTo(x,-15/transform.s);ctx.lineTo(x,scene.canvas.height+15/transform.s);ctx.stroke();}
   ctx.strokeStyle='#d9dec155';ctx.beginPath();ctx.moveTo(min,scene.groundY);ctx.lineTo(max,scene.groundY);ctx.stroke();ctx.setLineDash([]);
  }
  const s=selected();if(s&&s.l.visible&&(!view.isolate||view.mode!=='seam'||s.l.id===activeLayer)){
   for(const p of displayCopies(s.o)){
    if(p.clipLeft!==null&&p.x+s.o.width<scene.loop.start)continue;const o=s.o,h=7/transform.s;ctx.strokeStyle=s.l.locked?'#dfb274':'#d1efaa';ctx.lineWidth=1.5/transform.s;ctx.strokeRect(p.x,o.y,o.width,o.height);
    if(!s.l.locked)for(const [x,y] of [[p.x,o.y],[p.x+o.width,o.y],[p.x,o.y+o.height],[p.x+o.width,o.y+o.height]]){ctx.fillStyle='#d1efaa';ctx.fillRect(x-h/2,y-h/2,h,h);ctx.strokeStyle='#21302b';ctx.lineWidth=1/transform.s;ctx.strokeRect(x-h/2,y-h/2,h,h);}
   }
  }
 }
 ctx.strokeStyle='#92a7a344';ctx.lineWidth=1/transform.s;if(view.mode!=='seam')ctx.strokeRect(0,0,view.mode==='edit'?Math.max(scene.loop.end,scene.canvas.width):scene.canvas.width,scene.canvas.height);
 ctx.restore();
 if(view.mode==='seam'&&view.guides){const x=scene.loop.end*transform.s+transform.tx;ctx.fillStyle='#d1efaa';ctx.fillRect(x-1,8,2,cssH-16);ctx.fillStyle='#233528';ctx.fillRect(x-104,10,208,23);ctx.fillStyle='#d1efaa';ctx.textAlign='center';ctx.font='10px system-ui';ctx.fillText('KRAJ   ←   SPOJ   →   POČETAK',x,25);ctx.textAlign='left';}
 $('zoomLabel').textContent=Math.round(view.zoom*100)+'%';$('stageLabel').textContent=view.mode==='seam'?'SPOJ PETLJE / '+(view.isolate?layer().name:'SVI SLOJEVI'):view.mode==='play'?'VOŽNJA / PARALLAX U POKRETU':'SCENA / '+scene.loop.end+' × '+scene.canvas.height;
 $('cameraValue').value=Math.round(view.camera)+' px';$('camera').value=view.camera;
}
function resize(){const rect=$('stage').getBoundingClientRect();cssW=rect.width;cssH=rect.height;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(cssW*dpr);canvas.height=Math.round(cssH*dpr);draw();}
function setMode(mode){view.mode=mode;view.panX=0;view.panY=0;view.zoom=1;if(mode!=='play')view.playing=false;updatePlay();document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));draw();}
function updatePlay(){$('playPause').textContent=view.playing?'Ⅱ':'▶';$('playPause').setAttribute('aria-label',view.playing?'Zaustavi animaciju':'Pokreni animaciju');}
function togglePlay(){if(view.mode!=='play')setMode('play');view.playing=!view.playing;updatePlay();}
function zoomBy(factor,point){const before=transform;view.zoom=clamp(view.zoom*factor,.15,12);if(point){const after=getTransform();const worldX=(point.x-before.tx)/before.s,worldY=(point.y-before.ty)/before.s;view.panX+=worldX-(point.x-after.tx)/after.s;view.panY+=worldY-(point.y-after.ty)/after.s;}draw();}
function opaqueHit(o,x,y){const mask=masks.get(o.assetId);if(!mask)return true;let u=(x-o.x)/o.width,v=(y-o.y)/o.height;if(o.flipX)u=1-u;if(o.flipY)v=1-v;const ix=clamp(Math.floor(u*mask.w),0,mask.w-1),iy=clamp(Math.floor(v*mask.h),0,mask.h-1);return mask.data[(iy*mask.w+ix)*4+3]>20;}
function hit(point){
 const s=selected();if(s&&!s.l.locked&&s.l.visible&&(!view.isolate||view.mode!=='seam'||s.l.id===activeLayer))for(const p of displayCopies(s.o)){
  const pts=[[p.x,s.o.y,'nw'],[p.x+s.o.width,s.o.y,'ne'],[p.x,s.o.y+s.o.height,'sw'],[p.x+s.o.width,s.o.y+s.o.height,'se']];
  for(const [x,y,handle]of pts)if(Math.abs(point.x-x)<9/transform.s&&Math.abs(point.y-y)<9/transform.s)return {l:s.l,o:s.o,p,handle};
 }
 for(const l of [...scene.layers].reverse()){
  if(!l.visible||l.locked||l.opacity===0||(view.mode==='seam'&&view.isolate&&l.id!==activeLayer))continue;
  for(const o of [...l.objects].reverse()){
   if(o.visible===false||o.opacity===0)continue;
   for(const p of displayCopies(o))if(point.x>=p.x&&point.x<=p.x+o.width&&point.y>=o.y&&point.y<=o.y+o.height&&(p.clipLeft===null||point.x>=p.clipLeft)&&opaqueHit(o,point.x-p.copy,point.y))return {l,o,p};
  }
 }return null;
}
function snap(v){return view.snap?Math.round(v/10)*10:round(v);}
canvas.onpointerdown=e=>{
 if(!ready||e.button===2)return;canvas.focus();const pt=worldPoint(e);
 if(space||e.button===1){drag={type:'pan',clientX:e.clientX,clientY:e.clientY,panX:view.panX,panY:view.panY};canvas.setPointerCapture(e.pointerId);return;}
 if(view.mode==='play'){say('Za pomicanje elemenata odaberi Slaganje ili Spoj petlje.');return;}
 const h=hit(pt);if(!h){selection=null;refresh();return;}
 selectObject(h.o.id,h.l.id);drag={type:h.handle?'resize':'move',handle:h.handle,o:h.o,original:clone(h.o),point:pt,copy:h.p.copy,before:JSON.stringify(scene)};canvas.setPointerCapture(e.pointerId);e.preventDefault();
};
canvas.onpointermove=e=>{
 const p=worldPoint(e);if(!drag){const h=view.mode==='play'?null:hit(p);canvas.style.cursor=space?'grab':h?.handle?((h.handle==='nw'||h.handle==='se')?'nwse-resize':'nesw-resize'):h?'move':'default';return;}
 if(drag.type==='pan'){view.panX=drag.panX-(e.clientX-drag.clientX)/transform.s;view.panY=drag.panY-(e.clientY-drag.clientY)/transform.s;draw();return;}
 const d=drag,o=d.o,a=d.original,dx=p.x-d.point.x,dy=p.y-d.point.y;
 if(d.type==='move'){o.x=clamp(snap(a.x+dx),-100000,150000);o.y=clamp(snap(a.y+dy),-100000,150000);}
 else{
  const west=d.handle.includes('w'),north=d.handle.includes('n');let w=Math.max(4,a.width+(west?-dx:dx)),h=Math.max(4,a.height+(north?-dy:dy));
  if($('aspectLock').checked&&!e.shiftKey){const scale=Math.abs(w/a.width-1)>Math.abs(h/a.height-1)?w/a.width:h/a.height;w=a.width*scale;h=a.height*scale;}
  o.width=clamp(snap(w),4,32768);o.height=clamp(snap(h),4,8192);o.x=snap(west?a.x+a.width-o.width:a.x);o.y=snap(north?a.y+a.height-o.height:a.y);
 }
 if(view.mode==='seam'&&R.repeats(d.original,scene.loop)){const length=scene.loop.end-scene.loop.start;o.x=round(scene.loop.start+((o.x-scene.loop.start)%length+length)%length);}
 inspector();draw();
};
function finishDrag(cancel=false){if(!drag)return;if(drag.type!=='pan'){if(cancel)Object.assign(drag.o,drag.original);else{
  if(view.mode==='seam'&&R.repeats(drag.original,scene.loop)){const length=scene.loop.end-scene.loop.start;drag.o.x=round(scene.loop.start+((drag.o.x-scene.loop.start)%length+length)%length);}
  record(drag.before);
 }}drag=null;refresh();}
canvas.onpointerup=()=>finishDrag();canvas.onpointercancel=()=>finishDrag(true);
canvas.onwheel=e=>{e.preventDefault();const r=canvas.getBoundingClientRect();zoomBy(Math.exp(-e.deltaY*.0015),{x:e.clientX-r.left,y:e.clientY-r.top});};
canvas.ondragover=e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';};canvas.ondrop=e=>{e.preventDefault();if(view.mode==='play')setMode('edit');const assetId=e.dataTransfer.getData('application/x-scena-asset');let p=worldPoint(e);if(view.mode==='seam'){const L=scene.loop.end-scene.loop.start;p.x=scene.loop.start+((p.x-scene.loop.start)%L+L)%L;}if(assetId)addAsset(assetId,p);};
function removeObject(){const s=editable();if(!s)return;commit(()=>{s.l.objects=s.l.objects.filter(o=>o.id!==selection);selection=null;});}
function duplicateObject(){const s=editable();if(!s)return;commit(()=>{const o=clone(s.o);o.id=id();o.name+=' · kopija';o.x+=30;o.y+=0;s.l.objects.push(o);selection=o.id;});}
function moveOrder(array,item,delta){const index=array.indexOf(item),target=clamp(index+delta,0,array.length-1);array.splice(index,1);array.splice(target,0,item);}
function bindRange(name,apply){let before=null;$(name).onpointerdown=()=>{before=JSON.stringify(scene);};$(name).oninput=()=>{if(before===null)before=JSON.stringify(scene);apply(Number($(name).value));inspector();draw();};$(name).onchange=()=>{if(before!==null){record(before);before=null;}refresh();};}
for(const input of document.querySelectorAll('[data-prop]'))input.onchange=()=>{
 const s=editable();if(!s){inspector();return;}const key=input.dataset.prop;const value=key==='name'?input.value.trim().slice(0,100):Number(input.value);if(key!=='name'&&!Number.isFinite(value)){inspector();return;}
 commit(()=>{const o=s.o;if(key==='width'||key==='height'){const old=o[key],v=clamp(value,1,key==='width'?32768:8192);if($('aspectLock').checked){const other=key==='width'?'height':'width';o[other]=round(clamp(o[other]*v/old,1,other==='width'?32768:8192));}o[key]=v;}else o[key]=key==='name'?(value||'Element'):clamp(value,-100000,150000);});
};
$('objectLayer').onchange=()=>{const s=editable(),to=scene.layers.find(l=>l.id===$('objectLayer').value);if(!s||!to||to.locked){say('Ciljni sloj je zaključan.');inspector();return;}commit(()=>{s.l.objects=s.l.objects.filter(o=>o.id!==s.o.id);to.objects.push(s.o);activeLayer=to.id;});};
bindRange('objectOpacity',v=>{const s=selected();if(s&&!s.l.locked)s.o.opacity=v;});
$('objectRepeat').onchange=()=>{const s=editable();if(s)commit(()=>s.o.repeat=$('objectRepeat').value);};
$('deleteObject').onclick=removeObject;$('duplicateObject').onclick=duplicateObject;
$('flipX').onclick=()=>{const s=editable();if(s)commit(()=>s.o.flipX=!s.o.flipX);};
for(const [button,fn] of [['alignGround',o=>o.y=round(scene.groundY-o.height)],['alignStart',o=>o.x=scene.loop.start],['alignEnd',o=>o.x=round(scene.loop.end-o.width)],['fillLoop',o=>{o.x=scene.loop.start;o.width=scene.loop.end-scene.loop.start;o.repeat='loop';}]])$(button).onclick=()=>{const s=editable();if(s)commit(()=>fn(s.o));};
$('objectForward').onclick=()=>{const s=editable();if(s)commit(()=>moveOrder(s.l.objects,s.o,1));};$('objectBackward').onclick=()=>{const s=editable();if(s)commit(()=>moveOrder(s.l.objects,s.o,-1));};
$('layerName').onchange=()=>commit(()=>layer().name=$('layerName').value.trim().slice(0,100)||'Sloj');
$('layerSpeed').onchange=()=>{const v=Number($('layerSpeed').value);if(Number.isFinite(v))commit(()=>layer().parallax=clamp(v,0,3));};bindRange('layerSpeedRange',v=>layer().parallax=v);bindRange('layerOpacity',v=>layer().opacity=v);
$('layerVisible').onchange=()=>commit(()=>layer().visible=$('layerVisible').checked);$('layerLocked').onchange=()=>commit(()=>layer().locked=$('layerLocked').checked);
$('layerForward').onclick=()=>commit(()=>moveOrder(scene.layers,layer(),1));$('layerBackward').onclick=()=>commit(()=>moveOrder(scene.layers,layer(),-1));
$('addLayer').onclick=()=>{if(scene.layers.length>=80){say('Dosegnuto je 80 slojeva.');return;}commit(()=>{const l={id:id(),name:'Novi sloj',parallax:.7,opacity:1,visible:true,locked:false,objects:[]};const index=scene.layers.indexOf(layer());scene.layers.splice(index+1,0,l);activeLayer=l.id;selection=null;});setTab('layer');};
$('deleteLayer').onclick=()=>{if(scene.layers.length<=1)return;commit(()=>{const i=scene.layers.indexOf(layer());scene.layers.splice(i,1);activeLayer=scene.layers[Math.min(i,scene.layers.length-1)].id;selection=null;});};
$('duplicateLayer').onclick=()=>{if(scene.layers.length>=80)return;commit(()=>{const l=clone(layer());l.id=id();l.name+=' · kopija';l.objects.forEach(o=>o.id=id());scene.layers.splice(scene.layers.indexOf(layer())+1,0,l);activeLayer=l.id;selection=null;});};
function loopChange(which){const v=Number($(which).value);if(!Number.isFinite(v)){inspector();return;}commit(()=>{
 if(which==='loopStart'){const length=scene.loop.end-scene.loop.start;scene.loop.start=Math.round(clamp(v,0,100000));if(scene.loop.end<scene.loop.start+128)scene.loop.end=scene.loop.start+length;scene.loop.end=Math.min(scene.loop.end,scene.loop.start+50000);}
 else if(which==='loopEnd')scene.loop.end=Math.round(clamp(v,scene.loop.start+128,scene.loop.start+50000));
 else scene.loop.end=scene.loop.start+Math.round(clamp(v,128,50000));
 });view.panX=0;view.zoom=1;draw();}
for(const n of ['loopStart','loopEnd','loopLength'])$(n).onchange=()=>loopChange(n);
$('fitSurfaces').onclick=()=>{commit(()=>{
 for(const l of scene.layers){
  l.objects=l.objects.filter(o=>!o.surfaceIntroFor);
  const targets=l.objects.filter(o=>o.surface);
  for(const o of targets){o.x=scene.loop.start;o.width=scene.loop.end-scene.loop.start;o.repeat='loop';if(scene.loop.start>0){const intro=clone(o);intro.id=id();intro.name+=' · uvod';intro.x=0;intro.width=scene.loop.start;intro.repeat='once';intro.surfaceIntroFor=o.id;l.objects.unshift(intro);}}
 }
 });say('Podloge su prilagođene uvodu i petlji. Položaji kuća ostali su tvoji.');};
for(const [name,key,min,max] of [['viewportWidth','width',240,8192],['sceneHeight','height',128,4096]])$(name).onchange=()=>{const v=Number($(name).value);if(Number.isFinite(v))commit(()=>scene.canvas[key]=Math.round(clamp(v,min,max)));};
$('groundY').onchange=()=>{const v=Number($('groundY').value);if(Number.isFinite(v))commit(()=>scene.groundY=clamp(v,0,scene.canvas.height));};
$('phoneView').onclick=()=>{commit(()=>scene.canvas.width=scene.canvas.width===480?2172:480);setMode('play');};
$('clearScene').onclick=()=>{commit(()=>{scene.layers.forEach(l=>l.objects=[]);selection=null;});say('Scena je prazna. ↶ vraća prethodni raspored.');};
$('projectName').onchange=()=>commit(()=>scene.name=$('projectName').value.trim().slice(0,100)||'Moj grad');
$('grid').onchange=()=>{view.grid=$('grid').checked;draw();};$('snap').onchange=()=>view.snap=$('snap').checked;
$('isolateLayer').onchange=()=>{view.isolate=$('isolateLayer').checked;draw();};$('seamGuides').onchange=()=>{view.guides=$('seamGuides').checked;draw();};
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
for(const n of ['toSeam','inspectSeam'])$(n).onclick=()=>{setMode('seam');setTab('loop');};$('loopSettings').onclick=()=>setTab('loop');
$('playPause').onclick=togglePlay;$('toStart').onclick=()=>{view.camera=0;view.playing=false;updatePlay();draw();};$('camera').oninput=()=>{const next=Number($('camera').value);if(view.mode!=='play')setMode('play');view.camera=next;view.playing=false;updatePlay();draw();};
$('speed').onchange=()=>{view.speed=clamp(Number($('speed').value)||160,1,3000);$('speed').value=view.speed;};
$('zoomIn').onclick=()=>zoomBy(1.25);$('zoomOut').onclick=()=>zoomBy(.8);$('fit').onclick=()=>{view.zoom=1;view.panX=0;view.panY=0;draw();};
$('undo').onclick=()=>history(true);$('redo').onclick=()=>history(false);
$('assetSearch').oninput=renderLibrary;$('assetCategory').onchange=renderLibrary;
$('help').onclick=()=>$('helpDialog').showModal();$('closeHelp').onclick=()=>$('helpDialog').close();
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
function packageProject(exportScene=scene,exportAssets=null){
 const used=new Set(exportScene.layers.flatMap(l=>l.objects.map(o=>o.assetId)));
 return {format:'scena-parallax',version:1,exportedAt:new Date().toISOString(),scene:clone(exportScene),assets:exportAssets||[...used].map(key=>{const a=catalog.get(key);return {id:a.id,name:a.name,width:a.width,height:a.height,category:a.category,data:a.data};}),rendering:{coordinates:'Scene pixels; x/y is top-left. Layers and objects are drawn back-to-front in array order.',loop:'Repeat interval [start,end). Auto repeats when object top-left x is within that interval; other auto objects appear once. Explicit loop always repeats, once never repeats. Crossing edges wrap; repeated copies clip before loop.start.',parallax:'Horizontal offset per layer = cameraX * layer.parallax. Do not reset camera at loop.end.',alpha:'PNG alpha is baked in; multiply only by stored layer.opacity and object.opacity.',rendererSource:B.runtimeSource},handoff:'Hermes: this file includes every used PNG as a data URI. Use scene settings and the bundled reference renderer; do not flatten the layers. You can import this same file back into Scena editor.'};
}
function exportProject(){if(!ready)return;const data=packageProject(),slug=scene.name.replace(/[^a-zA-Z0-9čćžšđČĆŽŠĐ_-]+/g,'-').replace(/^-|-$/g,'')||'scena';download(new Blob([JSON.stringify(data)],{type:'application/json'}),slug+'.parallax.json');say('Cijeli projekt preuzet za daljnje uređivanje.');}
$('exportProject').onclick=exportProject;
async function packageLoop(){
 const source=clone(scene),start=source.loop.start,length=source.loop.end-start,height=source.canvas.height;
 const output=clone(source),assets=[];output.loop={start:0,end:length};output.layers=[];
 // Bake only the selected rectangle, one layer at a time. Chunks keep large
 // loops within browser image limits; their repeat interval remains the full loop.
 for(const l of source.layers){
  if(l.visible===false)continue;
  const next={...l,locked:false,objects:[]};output.layers.push(next);
  for(let x=0;x<length;x+=4096){
   const width=Math.min(4096,length-x),c=document.createElement('canvas');c.width=width;c.height=height;
   const cx=c.getContext('2d');if(!cx)throw Error('Preglednik nije mogao pripremiti sliku sloja.');
   for(const o of l.objects){
    if(o.visible===false||o.x+o.width<=start+x||o.x>=start+x+width||o.y+o.height<=0||o.y>=height)continue;
    const img=images.get(o.assetId);if(!img)throw Error('Nedostaje slika: '+o.name);
    R.paint(cx,img,o,o.x-start-x);
   }
   const assetId=id(),data=c.toDataURL('image/png');if(!data.startsWith('data:image/png;base64,'))throw Error('Slika sloja je prevelika za ovaj preglednik.');
   assets.push({id:assetId,name:l.name+' · petlja '+(x+1)+'–'+(x+width),category:'Petlja za igru',width,height,data});
   next.objects.push({id:id(),name:l.name+' · dio petlje',assetId,x,y:0,width,height,opacity:1,flipX:false,flipY:false,repeat:'loop',visible:true});
   c.width=c.height=1;
   await new Promise(resolve=>setTimeout(resolve,0));
  }
 }
 if(!output.layers.length)throw Error('Uključi barem jedan vidljivi sloj prije izvoza.');
 const data=packageProject(output,assets);
 data.exportMode='loop-only';data.sourceRegion={start,end:start+length};
 data.rendering.loopOnly={period:length,units:'All positions, widths, cameraX and viewportWidth are scene pixels. Apply display scaling once to the entire result.',placement:'For each layer independently: offset = cameraX * layer.parallax; phase = ((offset % period) + period) % period. For every chunk, draw all visible copies at chunk.x + k * period - phase, with its stored width/height. Parallax affects offset only, never spacing or dimensions.',chunks:'PNG chunks are adjacent parts of ONE layer period, not independent full backgrounds. A 4500px loop has chunks x=0 width=4096 and x=4096 width=404; BOTH repeat every 4500px. Keep transparent margins.',camera:'Pass continuous total camera distance BEFORE parallax in scene pixels. Do not apply another game-camera transform around the renderer, reset the camera at period, use a shared layer lap count or append copies using player distance.',validation:'Check at least 100 periods per layer at parallax 0, .16, .34, .62 and 1, including wide viewports. Corresponding copies must always be exactly period pixels apart in scene space.'};
 data.handoff='Hermes: GAME LOOP ONLY. Each visible layer is baked to transparent PNG chunks from exactly the selected source rectangle. No intro or content outside it is included. Repeat every layer over scene.loop.end pixels, preserve layer order, opacity and parallax. Do not fit the whole loop into the screen: scene.canvas.width is the camera viewport, NOT loop length. Objects within a layer have been baked; retain the full editor project for individual object editing. PNG data and Canvas 2D renderer are embedded.';
 return data;
}
$('exportLoop').onclick=async()=>{
 if(!ready)return;const button=$('exportLoop');button.disabled=true;say('Pripremam samo odabrani dio, sloj po sloj…');
 try{const data=await packageLoop();validateProject(data);const blob=new Blob([JSON.stringify(data)],{type:'application/json'});if(blob.size>150*1024*1024)throw Error('Izvoz prelazi 150 MB. Smanji visinu ili duljinu petlje.');const slug=data.scene.name.replace(/[^a-zA-Z0-9čćžšđČĆŽŠĐ_-]+/g,'-').replace(/^-|-$/g,'')||'scena';download(blob,slug+'-petlja.parallax.json');say('Petlja preuzeta za igru. Izvorni projekt ostaje nepromijenjen.');}
 catch(e){say('Nisam izvezao petlju: '+e.message);}finally{button.disabled=false;}
};
function validateProject(data){
 if(!data||data.format!=='scena-parallax'||data.version!==1||!data.scene||!Array.isArray(data.assets))throw Error('Odaberi projekt iz ovog editora (.parallax.json).');
 const s=data.scene,finite=(v,a,b)=>typeof v==='number'&&Number.isFinite(v)&&v>=a&&v<=b;
 if(!s.canvas||!finite(s.canvas.width,240,8192)||!finite(s.canvas.height,128,4096)||!s.loop||!finite(s.loop.start,0,100000)||!finite(s.loop.end-s.loop.start,128,50000)||!finite(s.groundY,0,4096)||!Array.isArray(s.layers)||!s.layers.length||s.layers.length>80)throw Error('Dimenzije ili petlja u projektu nisu valjane.');
 const ids=new Set(),assetIds=new Set();let total=0;
 for(const a of data.assets){if(!a||typeof a.id!=='string'||assetIds.has(a.id)||typeof a.data!=='string'||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(a.data)||!finite(a.width,1,16384)||!finite(a.height,1,16384))throw Error('Projekt sadrži nevaljan slikovni asset.');assetIds.add(a.id);}
 for(const l of s.layers){if(!l||typeof l.id!=='string'||ids.has(l.id)||!finite(l.parallax,0,3)||!finite(l.opacity,0,1)||!Array.isArray(l.objects))throw Error('Nevaljan sloj.');ids.add(l.id);
  for(const o of l.objects){total++;if(!o||typeof o.id!=='string'||ids.has(o.id)||!assetIds.has(o.assetId)||!finite(o.x,-100000,150000)||!finite(o.y,-100000,150000)||!finite(o.width,1,32768)||!finite(o.height,1,8192)||!finite(o.opacity,0,1)||!['auto','once','loop'].includes(o.repeat))throw Error('Nevaljan element ili nedostaje njegova slika.');ids.add(o.id);}
 }
 if(total>2000)throw Error('Projekt ima više od 2000 elemenata.');return true;
}
async function importProject(file){
 if(!file)return;try{if(file.size>150*1024*1024)throw Error('Projekt je veći od 150 MB.');const data=JSON.parse(await file.text());validateProject(data);
  // Decode into fresh IDs first. Imported rendererSource is data only, never executed.
  const idMap=new Map(),pending=[];
  for(const a of data.assets){const existing=catalog.get(a.id);if(existing&&existing.data===a.data){idMap.set(a.id,a.id);continue;}const copy={...a,id:id(),name:String(a.name||'Uvezeni asset').slice(0,100),category:'Uvezeno'};idMap.set(a.id,copy.id);pending.push(copy);}
  await Promise.all(pending.map(loadAsset));
  const next=clone(data.scene);next.name=String(next.name||'Uvezeni projekt').slice(0,100);for(const l of next.layers){l.name=String(l.name||'Sloj').slice(0,100);l.visible=l.visible!==false;l.locked=!!l.locked;for(const o of l.objects){o.assetId=idMap.get(o.assetId);o.name=String(o.name||'Element').slice(0,100);o.flipX=!!o.flipX;o.flipY=!!o.flipY;o.visible=o.visible!==false;}}
  pending.forEach(a=>{catalog.set(a.id,a);customAssets.set(a.id,a);});commit(()=>{scene=next;activeLayer=scene.layers.at(-1).id;selection=null;});categories();renderLibrary();view.camera=0;setMode('edit');say('Projekt je otvoren, zajedno sa svim slikama.');
 }catch(e){say('Nisam otvorio projekt: '+e.message);}finally{$('projectFile').value='';}
}
$('openProject').onclick=()=>$('projectFile').click();$('projectFile').onchange=()=>importProject($('projectFile').files[0]);
$('importImage').onclick=()=>$('imageFile').click();$('imageFile').onchange=async()=>{let n=0;for(const file of $('imageFile').files){try{
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>25*1024*1024)throw Error('Koristi PNG/JPG/WebP do 25 MB.');
 const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});const img=new Image();img.src=data;await img.decode();
 const a={id:id(),name:file.name.replace(/\.[^.]+$/,''),category:'Uvezeno',width:img.width,height:img.height,data,defaultWidth:Math.min(img.width,300)};await loadAsset(a);catalog.set(a.id,a);customAssets.set(a.id,a);n++;
 }catch(e){say(e.message);}}
 categories();$('assetCategory').value='Uvezeno';renderLibrary();scheduleSave();$('imageFile').value='';if(n)say(`Dodano slika u biblioteku: ${n}. Klikni za postavljanje.`);
};
$('snapshot').onclick=()=>{const c=document.createElement('canvas');c.width=scene.canvas.width;c.height=scene.canvas.height;const cx=c.getContext('2d');R.render(cx,scene,images,view.mode==='play'?view.camera:0,view.mode==='seam'?{designOffset:scene.loop.end-scene.canvas.width/2}:{});c.toBlob(blob=>download(blob,'scena-pregled.png'),'image/png');};
document.addEventListener('keydown',e=>{
 const typing=['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)||document.activeElement?.isContentEditable;if($('helpDialog').open)return;
 if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='s'){e.preventDefault();exportProject();return;}
 if(typing)return;const cmd=e.ctrlKey||e.metaKey;
 if(cmd&&e.key.toLowerCase()==='z'){e.preventDefault();history(!e.shiftKey);return;}if(cmd&&e.key.toLowerCase()==='y'){e.preventDefault();history(false);return;}
 if(cmd&&e.key.toLowerCase()==='d'){e.preventDefault();duplicateObject();return;}
 if(e.code==='Space'){e.preventDefault();space=true;canvas.style.cursor='grab';return;}
 if(e.key==='Escape'){finishDrag(true);selection=null;refresh();}
 if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();removeObject();}
 if(e.key.toLowerCase()==='p'){e.preventDefault();togglePlay();}if(e.key.toLowerCase()==='f')$('fit').click();
 if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){const s=editable();if(!s)return;e.preventDefault();const step=e.shiftKey?10:1;commit(()=>{if(e.key==='ArrowLeft')s.o.x-=step;if(e.key==='ArrowRight')s.o.x+=step;if(e.key==='ArrowUp')s.o.y-=step;if(e.key==='ArrowDown')s.o.y+=step;});}
});
document.addEventListener('keyup',e=>{if(e.code==='Space'){space=false;canvas.style.cursor='default';}});window.addEventListener('blur',()=>{space=false;finishDrag();});
let previous=0;function frame(t){const dt=Math.min((t-previous)/1000,.06);previous=t;if(ready&&view.playing){view.camera+=view.speed*dt;if(view.camera>Number($('camera').max))$('camera').max=view.camera+3*(scene.loop.end-scene.loop.start);draw();}requestAnimationFrame(frame);}requestAnimationFrame(frame);
new ResizeObserver(resize).observe($('stage'));
async function init(){try{
 await Promise.all(B.assets.map(loadAsset));
 try{db=await openDB();const saved=await loadSaved();if(saved?.scene){for(const a of saved.assets||[]){if(/^data:image\/(png|jpeg|webp);base64,/.test(a.data)){await loadAsset(a);catalog.set(a.id,a);customAssets.set(a.id,a);}}
  const candidate={format:'scena-parallax',version:1,scene:saved.scene,assets:[...new Set(saved.scene.layers.flatMap(l=>l.objects.map(o=>o.assetId)))].map(key=>catalog.get(key))};validateProject(candidate);scene=saved.scene;activeLayer=scene.layers.at(-1).id;$('saveState').textContent='✓ Obnovljena lokalna kopija';}else $('saveState').textContent='Sve slike su ugrađene · radi bez interneta';}catch(e){$('saveState').textContent='Preuzmi projekt za trajnu kopiju';}
 ready=true;$('loading').hidden=true;categories();renderLibrary();resize();refresh();document.body.dataset.ready='true';
 }catch(e){$('loading').textContent='Nisam uspio učitati assete: '+e.message;document.body.dataset.ready='error';}}
// Read-only inspection + deterministic canvas access for local verification.
window.ScenaEditor={getScene:()=>clone(scene),getAssets:()=>[...catalog.values()].map(a=>({id:a.id,name:a.name,category:a.category,width:a.width,height:a.height})),exportData:packageProject,validateProject,getView:()=>({...view,transform:{...transform}})};
init();
})();
