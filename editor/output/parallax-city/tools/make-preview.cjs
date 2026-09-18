const fs=require('fs');
const path=require('path');
const dir=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(`${dir}/manifest.json`));
const assets=manifest.layers.map(l=>({...l,url:'data:image/png;base64,'+fs.readFileSync(`${dir}/${l.file}`).toString('base64')}));
const template=fs.readFileSync(`${__dirname}/preview-template.html`,'utf8');
fs.writeFileSync(`${dir}/preview.html`,template.replace('__ASSETS__',JSON.stringify(assets)));
console.log('Standalone preview created.');
