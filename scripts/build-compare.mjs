// Gera website/compare-lm-studio.html a partir de docs/comparacao-lm-studio.md,
// com o mesmo renderer, cabeçalho, navegação lateral e rodapé de scripts/build-website.mjs.
// Uso: node scripts/build-compare.mjs
import {readFile,writeFile} from 'node:fs/promises';
import {marked} from 'marked';
const root=new URL('../',import.meta.url);
const {version}=JSON.parse(await readFile(new URL('package.json',root),'utf8'));
const source=await readFile(new URL('docs/comparacao-lm-studio.md',root),'utf8');
const slug=text=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const items=[];
const renderer=new marked.Renderer();
renderer.heading=function({tokens,depth,text}){const id=slug(text);if(depth===2)items.push({id,text});return `<h${depth} id="${id}">${this.parser.parseInline(tokens)}</h${depth}>\n`;};
let content=marked.parse(source,{renderer});
content=content.replace(/\[L(\d+)\]/g,'<a href="#fonte-l$1">[L$1]</a>').replace(/<li><a href="#fonte-l(\d+)">\[L\d+\]<\/a>/g,'<li id="fonte-l$1">[L$1]');
content=content.replace(/<table>/g,'<div class="table-wrap"><table>').replace(/<\/table>/g,'</table></div>');
const chunks=content.split(/(?=<h2 )/).map((s,i)=>`<section${i===0?' aria-label="Introdução"':''}>${s}</section>`).join('\n');
const nav=items.map(x=>`<a href="#${x.id}">${x.text}</a>`).join('');
await writeFile(new URL('website/compare-lm-studio.html',root),`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#080b0e"><title>LocalNeuron e LM Studio — comparação</title><meta name="description" content="Comparação factual entre LocalNeuron e LM Studio: motores, voz, imagem, música, EXO, Minha API, MCP, sistemas e licença, com fontes."><link rel="icon" href="./app-icon.png"><link rel="stylesheet" href="./style.css"></head><body><a class="skip" href="#main">Ir ao conteúdo</a><header class="guide-header"><a class="brand" href="./"><img src="./app-icon.png" width="34" height="34" alt="">LocalNeuron</a><nav aria-label="Navegação"><a href="./guide.html">Guia / Setup</a><a href="./#download">Downloads</a><a href="https://github.com/Arthur06311/localneuron">GitHub ↗</a></nav></header><div class="guide-shell"><nav class="guide-nav" aria-label="Nesta página">${nav}</nav><main class="guide-main" id="main"><p class="eyebrow">COMPARAÇÃO / PORTUGUÊS</p>${chunks}<p class="guide-top-links"><a href="./#download">Baixar o LocalNeuron</a><a href="./guide.html">Guia de configuração</a><a href="https://github.com/Arthur06311/localneuron/issues">Corrigir uma informação</a><a href="#main">Voltar ao início ↑</a></p></main></div><footer><a class="brand" href="./">LocalNeuron</a><p>Sua IA. Seu computador.</p><a href="./">Idioma e privacidade</a><span>${version} · Alfa</span></footer></body></html>`);
console.log('Generated website/compare-lm-studio.html from docs/comparacao-lm-studio.md');
