const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const OUT = path.resolve(__dirname, '..');
const W = 2172, H = 724;
const GEN = '/Users/Juki/.codex/generated_images/01a0abeb-05b3-7d81-b4eb-933514d8f53c';
const svg = content => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${content}</svg>`;
const rect = (x,y,w,h,c,extra='') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}" ${extra}/>`;
const layers = [];
async function native(id,label,speed,content,repeat='repeat') {
  const text=svg(content);
  fs.writeFileSync(`${OUT}/source/${id}.svg`,text);
  await sharp(Buffer.from(text)).png().toFile(`${OUT}/layers/${id}.png`);
  layers.push({id,label,file:`layers/${id}.png`,parallax:speed,repeat,opacity:1});
}
function skyline(color,seed,mid=false) {
  let n=seed; const rand=()=>{n=(n*1664525+1013904223)>>>0;return n/4294967296;};
  let out=rect(0,mid?440:389,W,220,color);
  // End buildings are level, so these silhouettes repeat without a discontinuity.
  out+=rect(0,mid?340:318,72,280,color)+rect(W-72,mid?340:318,72,280,color);
  let x=72;
  while(x<W-72){
    let w=Math.min(50+Math.floor(rand()*91),W-72-x);
    let y=(mid?306:240)+Math.floor(rand()*(mid?122:136));
    out+=rect(x,y,w,609-y,color);
    if(rand()>.62)out+=rect(x+Math.floor(w*.45),y-18,8,18,color);
    if(mid&&w>60){
      for(let xx=x+17;xx<x+w-10;xx+=26)for(let yy=y+24;yy<570;yy+=38)
        if(rand()>.25)out+=rect(xx,yy,8,12,'#d2d5d2','fill-opacity="0.32"');
    }
    x+=w;
  }
  return out;
}
async function generated(id,label,speed,filename,crop,position,repeat='repeat') {
  fs.copyFileSync(`${GEN}/${filename}`,`${OUT}/source/${id}-original.png`);
  const sprite=await sharp(`${GEN}/${filename}`).extract(crop).png().toBuffer();
  fs.writeFileSync(`${OUT}/sprites/${id}.png`,sprite);
  const normalized=await sharp(sprite).resize(position.width,position.height,{fit:'fill'}).png().toBuffer();
  await sharp({create:{width:W,height:H,channels:4,background:'#00000000'}})
    .composite([{input:normalized,left:position.x,top:position.y}]).png().toFile(`${OUT}/layers/${id}.png`);
  layers.push({id,label,file:`layers/${id}.png`,parallax:speed,repeat,opacity:1,
    sprite:{file:`sprites/${id}.png`,...position},generated:true});
}
async function main(){
 await native('01-sky','Nebo',0,`<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#c7cbca"/><stop offset=".5" stop-color="#aeb4b5"/><stop offset="1" stop-color="#858c8e"/></linearGradient></defs>${rect(0,0,W,H,'url(#sky)')}`,'fixed');
 await native('02-sun','Sunce',.025,`<circle cx="1775" cy="104" r="68" fill="#f2f0e1" fill-opacity=".38"/>`);
 let clouds='';
 for(const [x,y,s] of [[82,153,.82],[342,80,1.1],[940,181,.76],[1815,139,1.14]])
  clouds+=`<g transform="translate(${x} ${y}) scale(${s})" fill="#ebede9" fill-opacity=".55"><path d="M 0 27 C -15 0 35 -15 83 -10 C 98 -46 183 -45 190 -6 C 259 -19 315 5 300 29 C 288 50 26 49 0 27 Z"/></g>`;
 await native('03-clouds','Oblaci',.07,clouds);
 await native('04-skyline-far','Skyline 1 · daleki',.16,skyline('#969c9e',781));
 await native('05-skyline-mid','Skyline 2 · srednji',.34,skyline('#737a7c',415,true));
 await generated('06-skyline-near','Skyline 3 · blizu',.62,'exec-02f21891-b122-4d2c-a489-c76cfc2b94b3.png',{left:0,top:136,width:2172,height:449},{x:0,y:146,width:2172,height:449},'mirror');
 await generated('07-house','Kuća iza kafića',.69,'exec-30df9e04-b57d-426e-9868-adf7a619119d.png',{left:103,top:43,width:1349,height:937},{x:1063,y:167,width:615,height:427});
 await generated('08-cafe','Kafić',.78,'exec-566badbf-ed36-4a45-98ef-0f2bff6e9b64.png',{left:94,top:113,width:1586,height:680},{x:665,y:253,width:800,height:343});
 let lamps='';
 for(const x of [195,1690,2098])lamps+=`<g fill="#343b3e">${rect(x-3,439,6,158,'#343b3e')}${rect(x-6,582,12,15,'#343b3e')}<path d="M${x-10} 420 L${x+10} 420 L${x+8} 438 L${x-8} 438 Z" fill="#d2d5d2" fill-opacity=".32"/><path d="M${x-13} 420 Q${x-10} 408 ${x-3} 407 L${x-3} 403 L${x+3} 403 L${x+3} 407 Q${x+10} 408 ${x+13} 420 Z"/><path d="M${x-10} 420 L${x-8} 438 L${x+8} 438 L${x+10} 420 M${x-8} 438 L${x-4} 442 L${x+4} 442 L${x+8} 438" fill="none" stroke="#343b3e" stroke-width="3"/></g>`;
 await native('09-lamps','Ulične lampe',.82,lamps);
 let road=rect(0,595,W,22,'#737a7c')+rect(0,617,W,10,'#454b4d')+rect(0,627,W,H-627,'#2f3436');
 for(let x=0;x<W;x+=181)road+=`<path d="M${x} 595 l-12 22" stroke="#50575a" stroke-width="1" opacity=".32"/>`;
 for(let x=66;x<W;x+=362)road+=rect(x,684,115,5,'#454b4d');
 await native('10-road','Nogostup i cesta',1,road);
 await sharp(`${OUT}/layers/06-skyline-near.png`).flop().png().toFile(`${OUT}/variants/06-skyline-near-mirrored.png`);
 const manifest={name:'Urban cafe · parallax assets',canvas:{width:W,height:H},groundY:595,version:1,
    coordinates:'All layers are full 2172×724 canvases. Place at 0,0. Back-to-front array order. cameraX is in reference pixels.',
    alpha:'Sun/cloud opacity is baked into PNG alpha. Render every layer with globalAlpha=1.',
    palette:{sky:['#c7cbca','#aeb4b5','#858c8e'],sun:'rgba(242,240,225,0.38)',clouds:'rgba(235,237,233,0.55)',far:'#969c9e',mid:'#737a7c',near:'#50575a',road:'#2f3436',curb:'#454b4d',windows:'rgba(210,213,210,0.32)'},
    notes:['Cafe and house retain original muted colors. Imagegen reconstructed hidden architecture; this is not a pixel-exact separation.','Near street uses the gray palette approximately; generated shading and window values vary. Native SVG layers use exact supplied colors.','Near street requires alternating normal and mirrored tiles; do not repeat normal tiles alone. A mirrored PNG is included.','All PNGs have embedded alpha except the opaque sky. Backdrop layers fill underneath foreground to avoid exposed gaps.','House/cafe parallax values are starting points, adjustable to taste. Independent movement changes their overlap over long distances.'],layers};
 fs.writeFileSync(`${OUT}/manifest.json`,JSON.stringify(manifest,null,2));
 await sharp(`${OUT}/layers/01-sky.png`).composite(layers.slice(1).map(l=>({input:`${OUT}/${l.file}`}))).png().toFile(`${OUT}/preview.png`);
 fs.copyFileSync(path.resolve(OUT,'../imagegen/parallax-prompts.json'),`${OUT}/source/imagegen-prompts.json`);
 console.log('Exported',layers.length,'aligned layers, 3 sprites, SVG sources, manifest and preview.');
}
main().catch(e=>{console.error(e);process.exit(1)});
