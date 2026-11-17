import { mkdir,rm,copyFile,readFile,writeFile } from 'node:fs/promises';
// The source registry may contain ID numbers. Publish a copy without them;
// do not alter the original file or the Git history.
await rm('dist',{recursive:true,force:true});await mkdir('dist/vendor',{recursive:true});
// Remove legacy global Enter hijacking and forced fullscreen while preserving the
// application's existing Escape-to-close behavior. Both prevent normal keyboard use.
let html=(await readFile('index.html','utf8')).replace(/\r\n?/g,'\n');
// Remove the legacy Enter handler when present. The build remains safe when a
// source checkout already has it removed or its line endings differ.
const legacyScript=/<script>\s*document\.addEventListener\(['"]keydown['"],\s*function\(e\)\s*\{\s*if\s*\(e\.key!==['"]Enter['"][\s\S]*?<\/script>/;
html=html.replace(legacyScript,'');
// Strip only the forced-fullscreen portion; keep the site's Escape-to-close handler.
const fsStart=html.indexOf('var d=document.documentElement,armed=true;');
const escStart=html.indexOf('/* ESC: mbyll atë që është hapur sipër */',fsStart);
if(fsStart>=0&&escStart>=0)html=html.slice(0,fsStart)+html.slice(escStart);
html=html.replace('if(mr&&mr.children.length){','if(mr&&mr.children.length&&mr.getClientRects().length){');
await writeFile('dist/index.html',html);await copyFile('delegate-app.js','dist/delegate-app.js');await copyFile('team-core.js','dist/team-core.js');await copyFile('team-app.js','dist/team-app.js');
await copyFile('vendor/supabase.js','dist/vendor/supabase.js');
function sanitize(x){if(Array.isArray(x))return x.map(sanitize);if(x&&typeof x==='object'){const out={};for(const [k,v] of Object.entries(x)){if(['idNumber','photo','doc','photoName','docName','photoPath','photoUrl','documentPath','documentName','documentType'].includes(k))continue;out[k]=sanitize(v)}return out}return x;}
const registry=JSON.parse(await readFile('skuadrat.json','utf8'));await writeFile('dist/skuadrat.json',JSON.stringify(sanitize(registry)));
await copyFile('_headers','dist/_headers');
