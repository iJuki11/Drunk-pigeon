const fs=require('fs'),path=require('path'),sharp=require('sharp');
const out=path.resolve(__dirname,'..'),W=2172,H=724;
async function cropAlpha(input,min=8,pad=8){
 const {data,info}=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let x0=info.width,y0=info.height,x1=0,y1=0;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>=min){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
 const left=Math.max(0,x0-pad),top=Math.max(0,y0-pad);
 const width=Math.min(info.width,x1+1+pad)-left,height=Math.min(info.height,y1+1+pad)-top;
 return {buffer:await sharp(input).extract({left,top,width,height}).png().toBuffer(),left,top,width,height};
}
const native=[
 {id:'01-sky-gradient',label:'Nebo s gradijentom',parallax:0},
 {id:'02-sun',label:'Sunce',parallax:.025},
 {id:'03-clouds',label:'Oblaci',parallax:.07},
 {id:'04-skyline-far',label:'Daleki grad',parallax:.16},
 {id:'05-skyline-mid',label:'Srednji grad',parallax:.34},
];
const props=[
 {id:'tree-left',layer:'07-tree-left',label:'Drvo · široko',x:394,height:185,parallax:.66},
 {id:'tree-right',layer:'06-tree-right',label:'Drvo · usko',x:1575,height:190,parallax:.64},
 {id:'fence-wood',layer:'08-fence-wood',label:'Siva ograda',x:365,width:180,height:47,parallax:.66},
 {id:'hedge',layer:'09-hedge',label:'Živica',x:1370,width:440,height:66,parallax:.67,bottom:584},
 {id:'fence-stone',layer:'10-fence-stone',label:'Kameni zid',x:1380,width:430,height:47,parallax:.70},
];
async function main(){
 const generated=JSON.parse(fs.readFileSync(`${__dirname}/generated-paths.json`));
 const layers=native.map(n=>({...n,file:`layers/${n.id}.png`,width:W,height:H}));
 const sprites=[];
 for(const p of props){
  fs.copyFileSync(generated[p.id],`${__dirname}/${p.id}-original.png`);
  const c=await cropAlpha(generated[p.id],220,8);
  const file=`sprites/${p.id}.png`;fs.writeFileSync(`${out}/${file}`,c.buffer);
  const width=p.width??Math.round(p.height*c.width/c.height),height=p.height,y=(p.bottom??595)-height;
  await sharp({create:{width:W,height:H,channels:4,background:'#00000000'}}).composite([{input:await sharp(c.buffer).resize(width,height).png().toBuffer(),left:p.x,top:y}]).png().toFile(`${out}/layers/${p.layer}.png`);
  layers.push({id:p.layer,label:p.label,file:`layers/${p.layer}.png`,width:W,height:H,parallax:p.parallax});
  sprites.push({id:p.id,label:p.label,file,width:c.width,height:c.height,anchor:{x:.5,y:1},suggested:{x:p.x,y,width,height,parallax:p.parallax}});
 }
 const sun=await cropAlpha(`${out}/layers/02-sun.png`,1,4);
 fs.writeFileSync(`${out}/sprites/sun.png`,sun.buffer);sprites.push({id:'sun',label:'Sunce',file:'sprites/sun.png',width:sun.width,height:sun.height,suggested:{x:sun.left,y:sun.top,parallax:.025}});
 const ranges=[[0,333],[333,800],[800,1500],[1500,W]];
 for(let i=0;i<ranges.length;i++){
  const [x0,x1]=ranges[i];const part=await sharp(`${out}/layers/03-clouds.png`).extract({left:x0,top:0,width:x1-x0,height:H}).png().toBuffer();
  const c=await cropAlpha(part,1,4),id=`cloud-${String(i+1).padStart(2,'0')}`,file=`sprites/${id}.png`;
  fs.writeFileSync(`${out}/${file}`,c.buffer);sprites.push({id,label:`Oblak ${i+1}`,file,width:c.width,height:c.height,suggested:{x:x0+c.left,y:c.top,parallax:.07}});
 }
 layers.sort((a,b)=>a.id.localeCompare(b.id));
 const bg=await sharp(`${out}/layers/01-sky-gradient.png`).composite(['04-skyline-far','05-skyline-mid'].map(id=>({input:`${out}/layers/${id}.png`}))).png().toBuffer();
 fs.writeFileSync(`${out}/background.png`,bg);
 const oldSource=path.resolve(out,'../parallax-city/source');
 for(const [from,to] of [['01-sky','01-sky-gradient'],['02-sun','02-sun'],['03-clouds','03-clouds'],['04-skyline-far','04-skyline-far'],['05-skyline-mid','05-skyline-mid']])fs.copyFileSync(`${oldSource}/${from}.svg`,`${__dirname}/${to}.svg`);
 const manifest={canvas:{width:W,height:H},layers,sprites,notes:[
  'PNG props are reconstructed from the original approved panorama with built-in imagegen; hidden parts are completed, not pixel-exact crops.',
  'Sky, sun, clouds and skyline reuse the previously approved gray parallax palette. Trees/hedge preserve olive-green colors from the first panorama.',
  'All full layers are aligned 2172x724 canvases. Sprites are tight independent PNGs with alpha. Choose layers OR equivalent sprites, not both.',
  'background.png combines sky + far + mid skyline only. It excludes sun, clouds, houses, cafe, trees, fences and road. Use it as an alternative to those three sky/skyline layers.',
  'Sun and cloud opacity is baked into alpha. Draw at opacity 1. Do not apply 0.38/0.55 a second time.',
  'Prop placements and parallax values are suggested starting values; adjust relative to cafe and houses. Foreground road/sidewalk covers below y=595.',
  'Fences and hedge are standalone sections with transparent margins, not guaranteed seamless repeating strips.'
 ]};
 fs.writeFileSync(`${out}/manifest.json`,JSON.stringify(manifest,null,2));
 const thumbs=[...sprites.filter(s=>!s.id.startsWith('cloud')), {label:'Oblaci · 4 zasebna PNG-a',file:'layers/03-clouds.png'},...layers.filter(l=>['01-sky-gradient','04-skyline-far','05-skyline-mid'].includes(l.id)),{label:'Background · spojeni slojevi',file:'background.png'}];
 const CW=1440,CH=980;
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${CH}"><defs><pattern id="check" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="#adb8b7"/><path d="M0 0H12V12H0zM12 12H24V24H12z" fill="#bdc6c3"/></pattern></defs><rect width="100%" height="100%" fill="#edf0eb"/><text x="32" y="43" font-family="Arial" font-size="25" fill="#273a32">Zasebni elementi za igru</text><text x="32" y="71" font-family="Arial" font-size="14" fill="#5a6e65">Stabla, ograde, živica i atmosfera · PNG s prozirnom pozadinom</text>`;
 const overlays=[];
 for(let i=0;i<thumbs.length;i++){
  const x=24+(i%4)*354,y=97+Math.floor(i/4)*284,t=thumbs[i];
  svg+=`<rect x="${x}" y="${y}" width="338" height="263" rx="9" fill="#fff"/><rect x="${x+8}" y="${y+8}" width="322" height="215" fill="url(#check)"/><text x="${x+13}" y="${y+247}" font-family="Arial" font-size="16" fill="#273a32">${t.label}</text>`;
  const b=await sharp(`${out}/${t.file}`).resize(306,197,{fit:'inside'}).png().toBuffer(),meta=await sharp(b).metadata();
  overlays.push({input:b,left:x+8+Math.round((322-meta.width)/2),top:y+8+Math.round((215-meta.height)/2)});
 }
 svg+='</svg>';
 await sharp(Buffer.from(svg)).composite(overlays).png().toFile(`${out}/elements-preview.png`);
 console.log(`Exported ${layers.length} layers and ${sprites.length} independent sprites.`);
}
main().catch(e=>{console.error(e);process.exit(1)});
