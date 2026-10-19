import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));

test('every stylesheet and script referenced by index.html is served',async()=>{
  const html=await readFile(resolve(root,'public/index.html'),'utf8');
  const server=await readFile(resolve(root,'src/server.ts'),'utf8');
  const start=server.indexOf('const staticFiles');
  assert.ok(start>=0,'staticFiles declaration missing');
  const end=server.indexOf('};',start);
  const block=server.slice(start,end);
  const refs=[...html.matchAll(/<(?:link|script)\b[^>]*\b(?:href|src)="(\/[^"]+)"/g)].map(match=>match[1]);
  assert.ok(refs.includes('/a11y-visual.css'));
  assert.ok(refs.includes('/navigation.css'));
  for(const ref of refs){
    const key=ref.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    assert.match(block,new RegExp(`['"]${key}['"]\\s*:`),`${ref} is missing from staticFiles`);
  }
});
