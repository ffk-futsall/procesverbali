import { mkdir,rm,copyFile,readFile,writeFile } from 'node:fs/promises';
// The source registry may contain ID numbers. Publish a copy without them;
// do not alter the original file or the Git history.
await rm('dist',{recursive:true,force:true});await mkdir('dist/vendor',{recursive:true});
for(const name of ['index.html','delegate-app.js'])await copyFile(name,`dist/${name}`);
await copyFile('vendor/supabase.js','dist/vendor/supabase.js');
function sanitize(x){if(Array.isArray(x))return x.map(sanitize);if(x&&typeof x==='object'){const out={};for(const [k,v] of Object.entries(x)){if(k==='idNumber')continue;out[k]=sanitize(v)}return out}return x;}
const registry=JSON.parse(await readFile('skuadrat.json','utf8'));await writeFile('dist/skuadrat.json',JSON.stringify(sanitize(registry)));
