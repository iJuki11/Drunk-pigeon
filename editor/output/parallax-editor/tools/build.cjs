const fs=require('fs'),path=require('path'),crypto=require('crypto'),sharp=require('sharp');
const root=path.resolve(__dirname,'../../..'),out=path.resolve(__dirname,'..'),pc=path.join(root,'output/parallax-city'),sc=path.join(root,'output/scenery-elements');
const city=JSON.parse(fs.readFileSync(path.join(pc,'manifest.json'))),scenery=JSON.parse(fs.readFileSync(path.join(sc,'manifest.json')));
const assets=[],byHash=new Map(),named=new Map();
async function add(id,name,category,file,defaults={}){
 const data=Buffer.isBuffer(file)?file:fs.readFileSync(file),hash=crypto.createHash('sha256').update(data).digest('hex');
 if(byHash.has(hash)){named.set(id,byHash.get(hash));return byHash.get(hash);}
 const m=await sharp(data).metadata(),asset={id,name,category,width:m.width,height:m.height,data:'data:image/png;base64,'+data.toString('base64'),...defaults};
 assets.push(asset);byHash.set(hash,id);named.set(id,id);return id;
}
let uid=0;const next=()=>`initial-${++uid}`;
function object(assetId,x,y,width,height,name,repeat='auto'){const a=assets.find(a=>a.id===named.get(assetId));return {id:next(),assetId:a.id,name:name||a.name,x,y,width:width||a.defaultWidth||a.width,height:height||a.defaultHeight||a.height,opacity:1,repeat,flipX:false,flipY:false,visible:true};}
function layer(id,name,parallax,objects,locked=false){return {id,name,parallax,opacity:1,visible:true,locked,objects};}
async function main(){
 await add('cafe','Kafić s terasom','Kuće i zgrade',path.join(pc,'sprites/08-cafe.png'),{defaultWidth:800,defaultHeight:343});
 await add('house','Kuća iza kafića','Kuće i zgrade',path.join(pc,'sprites/07-house.png'),{defaultWidth:615,defaultHeight:427});
 for(const b of city.buildingSprites){const h=b.id==='apartment'?420:260;await add(b.id,b.label,'Kuće i zgrade',path.join(pc,b.file),{defaultHeight:h,defaultWidth:Math.round(h*b.width/b.height)});}
 for(const s of scenery.sprites){const isSky=s.id==='sun'||s.id.startsWith('cloud');await add(s.id,s.label,isSky?'Nebo i oblaci':s.id==='road'?'Cesta':'Stabla i ograde',path.join(sc,s.file),{defaultWidth:s.suggested?.width||s.width,defaultHeight:s.suggested?.height||s.height,...(isSky||s.id==='road'?{defaultY:s.suggested.y}:{})});}
 const lamp=await sharp(path.join(pc,'layers/09-lamps.png')).extract({left:180,top:398,width:30,height:202}).png().toBuffer();
 await add('lamp','Ulična lampa','Ostali elementi',lamp,{defaultWidth:30,defaultHeight:202});
 await add('archer','Lik s lukom','Ostali elementi',path.join(root,'output/characters/archer-flat-character.png'),{defaultWidth:220,defaultHeight:330});
 for(const [id,name,file]of [['sky','Nebo · sivi gradijent','01-sky.png'],['far','Daleki grad','04-skyline-far.png'],['mid','Srednji grad','05-skyline-mid.png']])await add(id,name,'Pozadinski slojevi',path.join(pc,'layers',file),{defaultWidth:2172,defaultHeight:724,defaultY:0});
 // Every previously delivered layer is available, in addition to independent sprites.
 for(const l of city.layers)await add('city-'+l.id,l.label+' · cijeli sloj','Gotovi slojevi',path.join(pc,l.file),{defaultWidth:2172,defaultHeight:724,defaultY:0});
 for(const l of scenery.layers)await add('scenery-'+l.id,l.label+' · cijeli sloj','Gotovi slojevi',path.join(sc,l.file),{defaultWidth:2172,defaultHeight:724,defaultY:0});
 for(const [id,name,file]of [['street','Spojeni niz kuća','variants/06-skyline-near-continuous.png'],['street-mirror','Spojeni niz kuća · zrcalno','variants/06-skyline-near-mirrored.png'],['street-sprite','Spojeni niz kuća · obrezano','sprites/06-skyline-near.png']])await add(id,name,'Varijante',path.join(pc,file),{defaultWidth:2172,defaultHeight:id==='street-sprite'?449:724,defaultY:id==='street-sprite'?146:0});
 for(const [id,name,file]of [['original','Originalna panorama',path.join(root,'output/imagegen/urban-runner-background.png')],['preview','Složena panorama',path.join(pc,'preview.png')],['no-cafe','Grad bez kafića',path.join(pc,'background-without-landmarks.png')],['sky-composite','Nebo sa suncem i oblacima',path.join(pc,'sky-composite.png')],['background','Spojeno nebo i udaljeni grad',path.join(sc,'background.png')]])await add(id,name,'Spojene pozadine',file,{defaultWidth:2172,defaultHeight:724,defaultY:0});
 const layers=[layer('sky','Nebo',0,[object('sky',0,0,2172,724)],true),layer('sun','Sunce',.025,[object('sun',1703,32,144,144)]),layer('clouds','Oblaci',.07,scenery.sprites.filter(s=>s.id.startsWith('cloud')).map(s=>object(s.id,s.suggested.x,s.suggested.y,s.width,s.height))),layer('far','Daleki grad',.16,[object('far',0,0,2172,724)],true),layer('mid','Srednji grad',.34,[object('mid',0,0,2172,724)],true)];
 for(const l of city.layers.filter(l=>l.buildings))layers.push(layer(l.id,l.label,l.parallax,l.buildings.map(p=>object(p.asset,p.x,p.y,p.width,p.height))));
 layers.push(layer('house','Kuća iza kafića',.69,[object('house',1063,167,615,427)]));
 layers.push(layer('trees','Stabla i siva ograda',.71,scenery.sprites.filter(s=>['fence-wood','tree-left','tree-right'].includes(s.id)).sort((a,b)=>a.id==='fence-wood'?-1:b.id==='fence-wood'?1:0).map(s=>object(s.id,s.suggested.x,s.suggested.y,s.suggested.width,s.suggested.height))));
 layers.push(layer('cafe','Kafić',.78,[object('cafe',665,253,800,343)]));
 layers.push(layer('hedge','Živica i zid',.78,scenery.sprites.filter(s=>['hedge','fence-stone'].includes(s.id)).map(s=>object(s.id,s.suggested.x,s.suggested.y,s.suggested.width,s.suggested.height))));
 layers.push(layer('lamps','Ulične lampe',.82,[180,1675,2083].map(x=>object('lamp',x,398,30,202))));
 layers.push(layer('road','Cesta',1,[object('road',0,595,2172,129)],true));
 for(const l of layers)if(['sky','far','mid','road'].includes(l.id))l.objects.forEach(o=>o.surface=true);
 const scene={name:'Moj grad',canvas:{width:2172,height:724},groundY:595,loop:{start:0,end:2172},layers};
 const runtime=fs.readFileSync(path.join(out,'source/runtime.js'),'utf8'),js=fs.readFileSync(path.join(out,'source/editor.js'),'utf8'),css=fs.readFileSync(path.join(out,'source/style.css'),'utf8');
 const bundle={assets,scene,runtimeSource:runtime};
 const html=fs.readFileSync(path.join(out,'source/index.html'),'utf8').replace('__CSS__',()=>css).replace('__BUNDLE__',()=>JSON.stringify(bundle).replace(/</g,'\\u003c')).replace('__RUNTIME__',()=>runtime).replace('__APP__',()=>js);
 fs.writeFileSync(path.join(out,'editor.html'),html);fs.writeFileSync(path.join(out,'renderer.js'),runtime);
 fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify(assets.map(({data,...a})=>a),null,2));
 console.log(`Built standalone editor: ${assets.length} unique assets, ${layers.length} editable layers, ${layers.reduce((n,l)=>n+l.objects.length,0)} initial objects, ${(Buffer.byteLength(html)/1024/1024).toFixed(1)} MB.`);
}
main().catch(e=>{console.error(e);process.exit(1)});
