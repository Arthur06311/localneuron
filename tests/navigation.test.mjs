import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));

test('navigation is grouped into five discoverable islands',async()=>{
  const html=await readFile(resolve(root,'public/index.html'),'utf8');
  const js=await readFile(resolve(root,'public/app.js'),'utf8');
  const css=await readFile(resolve(root,'public/navigation.css'),'utf8');
  for(const island of ['work','crews','create','connect','account']){
    assert.match(html,new RegExp(`data-nav-island-group="${island}"`));
    assert.match(html,new RegExp(`id="nav-island-${island}"`));
  }
  assert.match(html,/navigation\.css/);
  assert.match(js,/navIslandForPage/);
  assert.match(js,/toggleNavIsland/);
  assert.match(css,/\.nav-island:not\(\[data-open="true"\]\) \.nav-island-menu\{display:none/);
});

test('every former destination remains present inside an island',async()=>{
  const html=await readFile(resolve(root,'public/index.html'),'utf8');
  for(const page of ['chat','team','models','crews','photo','studio','music','editor','connections','exo','sharing','pro','subscription','wizard','settings']){
    assert.match(html,new RegExp(`data-page="${page}"`),`Missing page ${page}`);
  }
});
