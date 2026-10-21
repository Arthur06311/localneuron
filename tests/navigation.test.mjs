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
  for(const island of ['work','teams','create','connect','account']){
    assert.match(html,new RegExp(`data-nav-island-group="${island}"`));
    assert.match(html,new RegExp(`id="nav-island-${island}"`));
  }
  assert.match(html,/navigation\.css/);
  assert.match(html,/>Equipes</);
  assert.match(html,/Membros no mesmo pedido/);
  assert.match(html,/Visão da equipe/);
  assert.match(html,/Conversas/);
  assert.match(html,/data-page="equipes"/);
  assert.match(html,/data-page="team"/);
  assert.match(html,/Minha equipe/);
  assert.doesNotMatch(html,/> Equipas</);
  assert.match(js,/navIslandForPage/);
  assert.match(js,/toggleNavIsland/);
  assert.match(css,/\.nav-island:not\(\[data-open="true"\]\) \.nav-island-menu\{display:none/);
});

test('the breadcrumb uses the island name from the navigation',async()=>{
  const html=await readFile(resolve(root,'public/index.html'),'utf8');
  const js=await readFile(resolve(root,'public/app.js'),'utf8');
  const sections=html.split('<section class="nav-island"').slice(1).map(section=>section.split('</section>')[0]);
  const island=(page,view)=>{
    const section=sections.find(item=>view?item.includes(`data-page="${page}"`)&&item.includes(`data-equipes-view="${view}"`):item.includes(`data-page="${page}"`));
    return section?.match(/<strong>([^<]+)<\/strong>/)?.[1];
  };
  assert.equal(island('chat'),'Trabalhar');
  assert.equal(island('models'),'Trabalhar');
  assert.equal(island('settings'),'Conta');
  assert.equal(island('server'),'Conectar');
  assert.match(js,/function breadcrumbLabel/);
  assert.match(js,/nav-island-trigger strong/);
  assert.doesNotMatch(js,/Conversas \/ Chat/);
  assert.doesNotMatch(js,/Biblioteca \/ Modelos/);
});

test('every former destination remains present inside an island',async()=>{
  const html=await readFile(resolve(root,'public/index.html'),'utf8');
  for(const page of ['chat','team','models','equipes','photo','studio','music','editor','connections','exo','server','sharing','pro','subscription','wizard','settings']){
    assert.match(html,new RegExp(`data-page="${page}"`),`Missing page ${page}`);
  }
});
