import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';

test('production build preserves native keyboard behavior and modal Escape',async()=>{
  execFileSync(process.execPath,['build.mjs'],{stdio:'pipe'});
  const html=await readFile('dist/index.html','utf8');
  const delegate=await readFile('dist/delegate-app.js','utf8');
  assert.ok(!html.includes("if(e.key!=='Enter'||e.isComposing||e.shiftKey)return"));
  assert.ok(!html.includes('navigator.keyboard.lock'));
  assert.ok(!html.includes('d.requestFullscreen||d.webkitRequestFullscreen'));
  assert.ok(html.includes("if(e.key!=='Escape'||e.defaultPrevented)return"));
  assert.ok(delegate.includes('e.key!==\'Tab\''));
  assert.ok(delegate.includes("root.querySelector('#dg-username').focus()"));
});
