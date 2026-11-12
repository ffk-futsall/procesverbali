import { mkdir,rm,copyFile,readFile,writeFile } from 'node:fs/promises';
// The source registry may contain ID numbers. Publish a copy without them;
// do not alter the original file or the Git history.
await rm('dist',{recursive:true,force:true});await mkdir('dist/vendor',{recursive:true});
// Remove legacy global Enter hijacking and forced fullscreen while preserving the
// application's existing Escape-to-close behavior. Both prevent normal keyboard use.
let html=await readFile('index.html','utf8');
const legacyStart="<script>\ndocument.addEventListener('keydown',function(e){if(e.key!=='Enter'";
const start=html.indexOf(legacyStart),end=html.indexOf('</script>',start);
if(start<0||end<0)throw new Error('Legacy keyboard handler not found; review keyboard build patch');
html=html.slice(0,start)+html.slice(end+'</script>'.length);
const fsStart=html.indexOf('  var d=document.documentElement,armed=true;',html.indexOf('<script id="ffk-fs-esc">'));
const escStart=html.indexOf('  /* ESC: mbyll atë që është hapur sipër */',fsStart);
if(fsStart<0||escStart<0)throw new Error('Fullscreen handler not found; review keyboard build patch');
html=html.slice(0,fsStart)+html.slice(escStart);
html=html.replace('if(mr&&mr.children.length){','if(mr&&mr.children.length&&mr.getClientRects().length){');
await writeFile('dist/index.html',html);await copyFile('delegate-app.js','dist/delegate-app.js');
await copyFile('vendor/supabase.js','dist/vendor/supabase.js');
function sanitize(x){if(Array.isArray(x))return x.map(sanitize);if(x&&typeof x==='object'){const out={};for(const [k,v] of Object.entries(x)){if(k==='idNumber')continue;out[k]=sanitize(v)}return out}return x;}
const registry=JSON.parse(await readFile('skuadrat.json','utf8'));await writeFile('dist/skuadrat.json',JSON.stringify(sanitize(registry)));
