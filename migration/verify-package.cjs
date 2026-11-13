const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const root=path.resolve(__dirname,'../apps/miniprogram'),meta=JSON.parse(fs.readFileSync(path.join(__dirname,'baseline.json'),'utf8'));
const errors=[];let scripts=0,jsons=0,requires=0,components=0,sourceFiles=0;
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
function assert(ok,message){if(!ok)errors.push(message);}
for(const [rel,digest]of Object.entries(meta.files)){
 for(const folder of [meta.source,meta.backup]){const f=path.resolve(__dirname,"..",folder,rel);assert(fs.existsSync(f)&&crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')===digest,`Original or backup changed: ${f}`);}sourceFiles++;
}
for(const file of walk(root)){
 const rel=path.relative(root,file).replaceAll('\\','/');if(rel.startsWith('tests/'))continue;
 const src=fs.readFileSync(file,'utf8');
 if(file.endsWith('.js')){
  scripts++;try{new vm.Script(src,{filename:rel});}catch(e){errors.push(e.message);}
  for(const [,ref]of src.matchAll(/require\(['"]([^'"]+)['"]\)/g)){
   if(!ref.startsWith('.'))continue;requires++;const target=path.resolve(path.dirname(file),ref);
   assert([target,target+'.js',target+'.json',path.join(target,'index.js')].some(f=>fs.existsSync(f)),`Missing module ${rel}: ${ref}`);
   assert(rel.startsWith('packages/')||!path.relative(root,target).replaceAll('\\','/').startsWith('packages/'),`Main package imports subpackage: ${rel}: ${ref}`);
  }
 }
 if(file.endsWith('.json')){jsons++;try{const data=JSON.parse(src);for(const [name,ref]of Object.entries(data.usingComponents||{})){components++;const base=ref.startsWith('/')?path.join(root,ref):path.resolve(path.dirname(file),ref);assert(fs.existsSync(base+'.js')&&fs.existsSync(base+'.wxml')&&fs.existsSync(base+'.json'),`Missing component ${name}: ${rel}`);}}catch(e){errors.push(`${rel}: ${e.message}`);}}
 if(file.endsWith('.wxml'))for(const [,ref]of src.matchAll(/src="(\/assets\/[^{}"]+)"/g))assert(fs.existsSync(path.join(root,ref)),`Missing asset ${rel}: ${ref}`);
}
const summary={sourceFilesVerified:sourceFiles,scripts,jsons,requires,components,errors};
fs.writeFileSync(path.join(__dirname,'package-verification.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));if(errors.length)process.exit(1);
