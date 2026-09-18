const fs=require('fs'),path=require('path'),sharp=require('sharp');
const dir=path.resolve(__dirname,'..'),W=2172,H=724;
const gen='/Users/Juki/.codex/generated_images/01a0abeb-05b3-7d81-b4eb-933514d8f53c';
const buildings=[
 {id:'apartment',label:'Stambena zgrada',file:'exec-3f3f20ca-7960-4a92-9e91-ea9d65d8b37a.png',crop:{left:255,top:121,width:506,height:1273}},
 {id:'gable-shop',label:'Kuća s kosim krovom',file:'exec-166f0fcc-9c5e-48b8-974d-c9958043931d.png',crop:{left:166,top:121,width:1018,height:938}},
 {id:'awning-shop',label:'Kuća s tendom',file:'exec-4da2df94-702e-49cf-ac30-dc0a362b3380.png',crop:{left:208,top:164,width:811,height:956}},
 {id:'narrow-house',label:'Uska gradska kuća',file:'exec-83e78d00-8ebe-4cc1-92f1-804359efecce.png',crop:{left:191,top:111,width:640,height:1312}},
];
const b=(asset,x,width,height)=>({asset,x,y:595-height,width,height});
const groups=[
 {id:'06a-houses-back',label:'Kuće · stražnji red',parallax:.48,buildings:[b('apartment',18,182,461),b('narrow-house',590,150,308),b('narrow-house',1685,152,312),b('apartment',2000,154,389)]},
 {id:'06b-houses-middle',label:'Kuće · srednji red',parallax:.55,buildings:[b('gable-shop',200,260,240),b('gable-shop',840,255,236),b('awning-shop',1780,210,248)]},
 {id:'06c-houses-front',label:'Kuće · prednji red',parallax:.62,buildings:[b('awning-shop',455,200,236),b('gable-shop',1460,245,226),b('narrow-house',750,130,267)]},
];
async function main(){
 let m=JSON.parse(fs.readFileSync(`${dir}/manifest.json`));
 for(const a of buildings){
  fs.copyFileSync(`${gen}/${a.file}`,`${dir}/source/building-${a.id}-original.png`);
  await sharp(`${gen}/${a.file}`).extract(a.crop).png().toFile(`${dir}/sprites/building-${a.id}.png`);
 }
 for(const g of groups){
  const inputs=await Promise.all(g.buildings.map(async p=>({input:await sharp(`${dir}/sprites/building-${p.asset}.png`).resize(p.width,p.height).png().toBuffer(),left:p.x,top:p.y})));
  await sharp({create:{width:W,height:H,channels:4,background:'#00000000'}}).composite(inputs).png().toFile(`${dir}/layers/${g.id}.png`);
  g.file=`layers/${g.id}.png`;g.repeat='repeat';g.opacity=1;
 }
 if(fs.existsSync(`${dir}/layers/06-skyline-near.png`)){
  fs.renameSync(`${dir}/layers/06-skyline-near.png`,`${dir}/variants/06-skyline-near-continuous.png`);
 }
 m.layers=[...m.layers.filter(l=>Number(l.id.slice(0,2))<6),...groups,...m.layers.filter(l=>Number(l.id.slice(0,2))>6)];
 m.version=2;
 m.buildingSprites=buildings.map(b=>({id:b.id,label:b.label,file:`sprites/building-${b.id}.png`,width:b.crop.width,height:b.crop.height}));
 m.notes=[
  'Cafe and house retain muted colors. Imagegen reconstructed hidden architecture; not a pixel-exact separation.',
  'Foreground houses are separated into three transparent rows at .48/.55/.62. Individual building sprites and placements are also included.',
  'All active layers use normal repetition, except fixed sky. Transparent margins and gaps are intentional. No mirrored tiles required for this default layout.',
  'Generated building colors approximate the gray palette; native SVG backgrounds use exact supplied colors.',
  'House/cafe values .69/.78 are adjustable suggestions. Independent movement changes their overlap over long distances.',
  'The earlier continuous near-street row is available only as an optional variant. It requires alternating normal and mirrored tiles.'
 ];
 fs.writeFileSync(`${dir}/manifest.json`,JSON.stringify(m,null,2));
 async function composite(name,list){await sharp(`${dir}/layers/01-sky.png`).composite(list.filter(l=>l.id!=='01-sky').map(l=>({input:`${dir}/${l.file}`}))).png().toFile(`${dir}/${name}.png`);}
 await composite('preview',m.layers);
 await composite('background-without-landmarks',m.layers.filter(l=>!['07-house','08-cafe','09-lamps'].includes(l.id)));
 await composite('sky-composite',m.layers.filter(l=>Number(l.id.slice(0,2))<=3));
 console.log('12 active layers, 4 individual gray buildings, full and background-only previews.');
}
main().catch(e=>{console.error(e);process.exit(1)});
