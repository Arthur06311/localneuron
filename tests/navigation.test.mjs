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

function lin(channel){const c=channel/255;return c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4;}
function contrast(front,back){
  const lum=hex=>{const n=hex.slice(1);const channels=[0,2,4].map(i=>lin(parseInt(n.slice(i,i+2),16)));return 0.2126*channels[0]+0.7152*channels[1]+0.0722*channels[2];};
  const light=Math.max(lum(front),lum(back)),dark=Math.min(lum(front),lum(back));
  return (light+0.05)/(dark+0.05);
}
function tokenBlock(css,header){
  const start=css.indexOf(header);
  assert.ok(start>=0,header);
  return css.slice(start,css.indexOf('}',start));
}
function token(block,name){
  const found=block.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(found,name);
  return found[1].toLowerCase();
}

test('navigation, islands and the current marker meet WCAG 2.1 AA',async()=>{
  const tokens=await readFile(resolve(root,'public/tokens.css'),'utf8');
  const shell=await readFile(resolve(root,'public/design-system.css'),'utf8');
  const nav=await readFile(resolve(root,'public/navigation.css'),'utf8');
  const js=await readFile(resolve(root,'public/app.js'),'utf8');
  const equipes=await readFile(resolve(root,'public/equipes.css'),'utf8');
  const equipesJs=await readFile(resolve(root,'public/equipes.js'),'utf8');
  const light=tokenBlock(tokens,':root');
  const dark=tokenBlock(tokens,'html[data-theme="dark"]');
  for(const theme of [light,dark]){
    const ink=token(theme,'--ink'),muted=token(theme,'--muted'),panel=token(theme,'--panel'),panel2=token(theme,'--panel2'),accent=token(theme,'--accent');
    assert.ok(contrast(ink,panel)>=4.5);
    assert.ok(contrast(ink,panel2)>=4.5);
    assert.ok(contrast(muted,panel)>=4.5);
    assert.ok(contrast(muted,panel2)>=4.5);
    assert.ok(contrast(accent,panel)>=3);
    assert.ok(contrast(accent,panel2)>=3);
  }
  assert.match(light,/--focus:\s*var\(--accent\)/);
  assert.match(dark,/--focus:\s*var\(--accent\)/);
  assert.match(shell,/nav-island\[data-current="true"\][\s\S]*color:\s*var\(--ink\) !important/);
  assert.match(shell,/button\.active::after \{[^}]*content: "Atual" \/ ""/);
  assert.match(shell,/button\.active::after \{[^}]*color: var\(--ink\)/);
  assert.doesNotMatch(shell,/button\.active::after \{[^}]*content: none/);
  assert.match(shell,/html\[lang="en"\] \.nav-island-menu button\.active::after \{ content: "Current" \/ ""/);
  assert.match(shell,/\.sidebar nav \.nav-island-trigger:focus-visible/);
  assert.match(shell,/\.sidebar nav \.nav-island-menu button:focus-visible/);
  assert.match(shell,/outline: 3px solid var\(--focus\) !important/);
  assert.match(nav,/content:"Atual" \/ ""/);
  assert.match(js,/setAttribute\('aria-current','page'\)/);
  assert.match(js,/dataset\.equipesView===equipesView/);
  assert.match(equipes,/eq-option\[aria-selected="true"\]::after\{content:"Atual" \/ ""/);
  assert.match(equipes,/eq-card\[aria-current="page"\]::after\{content:"Atual" \/ ""/);
  assert.match(equipes,/color:var\(--ink\)/);
  assert.match(equipes,/:focus-visible\{outline:3px solid var\(--focus\)/);
  assert.match(equipesJs,/aria-current="page"/);
  assert.doesNotMatch(equipesJs,/aria-current="true"/);
});
