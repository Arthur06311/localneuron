import { t, applyDocument, format, languagePreference, saveLanguagePreference, setText, textLocale } from './i18n.js';
import {createUX} from './ux.js';
import {createCreative} from './creative.js';
import {createExperience} from './experience.js';
import {createEquipes} from './equipes.js';
import {createPhoto} from './photo.js';
import{createExo}from'./exo.js';
import { createServerMode } from './server-mode.js';
import { mascotHTML, mascotGallery } from "./mascot.js";
import {modelIcon} from './model-icons.js';
import {mediaModelCard,selectedMediaFiles} from './media-library.js';
import { createSubscription } from './subscription.js';
import { createPro } from './pro.js';
import { icon } from './icons.js';
import { createHub } from './hub.js';
import { createStudio } from './studio.js';
import { mergeLibraryProgress } from './library-progress.js';
import { planLocalInstallArrival, localInstallEffects } from './first-model.js';
import { createChatUI } from './chat.js';
import { mountCommandPalette, paletteCommands } from './command-palette.js';
import { createSharingUI } from './sharing.js';
import { starterSuggestionHtml } from './starter-model.js';
import { sortSmallLocalFirst } from './chat-no-model.js';
import { mountMcpServers } from './mcp-servers.js';
import { FAMILY_ALL, MODEL_FILTERS, QUANTIZE_DETAIL_KEYS, QUANTIZE_STATE_KEYS, categoryKey, emptyCatalogAction, emptyCatalogMessageKey, isVisualFilter, modelMatchesFilter } from './model-filters.js';
const $=selector=>document.querySelector(selector);
document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
applyDocument(document);
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let workspace=null,page='chat',libraryStatus=null,libraryBusy=false,libraryEtag=null,toastTimer;
let theme=localStorage.getItem('colmeia-theme')||'system';
function applyTheme(){document.documentElement.dataset.theme=theme==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):theme;document.querySelectorAll('button[data-theme]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.theme===theme)));}
applyTheme();matchMedia('(prefers-color-scheme: dark)').addEventListener('change',applyTheme);
const navIslandForPage={chat:'work',team:'work',models:'work',crews:'teams',equipes:'teams',photo:'create',studio:'create',music:'create',editor:'create',connections:'connect',exo:'connect',server:'connect',sharing:'connect',pro:'account',subscription:'account',wizard:'account',settings:'account'};
const navIslandStorageKey='localneuron-nav-islands';
function readNavIslands(){try{const value=JSON.parse(localStorage.getItem(navIslandStorageKey)||'{}');return value&&typeof value==='object'?value:{}}catch{return {}}}
function syncNavIslands(){const saved=readNavIslands(),active=navIslandForPage[page]||'work';document.querySelectorAll('[data-nav-island-group]').forEach(group=>{const id=group.dataset.navIslandGroup;const open=id===active||saved[id]===true;group.dataset.open=String(open);group.dataset.current=String(id===active);group.querySelector('[data-nav-island]')?.setAttribute('aria-expanded',String(open));});}
function toggleNavIsland(id){const saved=readNavIslands(),group=document.querySelector(`[data-nav-island-group="${id}"]`);if(!group)return;const next=group.dataset.open!=='true';document.querySelectorAll('[data-nav-island-group]').forEach(item=>{item.dataset.open='false';item.querySelector('[data-nav-island]')?.setAttribute('aria-expanded','false');});if(next){group.dataset.open='true';group.querySelector('[data-nav-island]')?.setAttribute('aria-expanded','true');}Object.keys(saved).forEach(key=>delete saved[key]);if(next&&id!==navIslandForPage[page])saved[id]=true;localStorage.setItem(navIslandStorageKey,JSON.stringify(saved));}
async function api(path,options={}){const response=await fetch('/v1'+path,{...options,headers:{...(options.body!==undefined?{'content-type':'application/json'}:{}),...(options.method&&options.method!=='GET'?{'idempotency-key':crypto.randomUUID()}:{}),...options.headers},body:options.body===undefined?undefined:JSON.stringify(options.body)});const data=await response.json();if(!response.ok){if(data.code==='pro_required')document.dispatchEvent(new CustomEvent('localneuron:pro-required',{detail:data}));throw new Error(data.error||t('shell.couldNotFinish'));}return data;}
function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,8500);}
async function action(button,fn){button.disabled=true;try{await fn();}catch(error){toast(error.message);}finally{button.disabled=false;}}
function head(eyebrow,title,subtitle,control=''){return `<div class="page-head"><div><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><p class="subhead">${subtitle}</p></div>${control}</div>`;}
const uxUI=createUX({api,escape,toast,isUnlocked:()=>Boolean(workspace)});
const experienceUI=createExperience({api,escape,toast,navigate,isVisible:kind=>Boolean(workspace)&&page===kind,openChat:async(id,model)=>{chatUI.openConversation(id);navigate('chat',model);}});
let equipesView='conversas';
const equipesUI=createEquipes({api,escape,toast,isVisible:()=>Boolean(workspace)&&page==='equipes',view:()=>equipesView,setView:value=>{equipesView=value;}});
const creativeUI=createCreative({api,escape,toast,isVisible:kind=>Boolean(workspace)&&page===kind});
const photoUI=createPhoto({api,escape,toast,recommend:()=>experienceUI.recommend('image'),isVisible:()=>Boolean(workspace)&&page==='photo'});
const exoUI=createExo({api,escape,toast,navigate,isVisible:()=>Boolean(workspace)&&page==='exo'});
const serverModeUI=createServerMode({api,escape,toast,isVisible:()=>Boolean(workspace)&&page==='server'});
const chatUI=createChatUI({api,escape,toast,showLibrary:(options)=>navigate('models',undefined,options),openProject:id=>{proUI.selectProject(id);navigate('pro');},isVisible:()=>Boolean(workspace)&&page==='chat'});
const hubUI=createHub({api,escape,toast,installed:async name=>{modelSearch=name;modelFilter='all';modelFamily=FAMILY_ALL;modelPage=0;await refreshLibrary();$('#model-search')?.scrollIntoView({block:'center'});}});
const studioUI=createStudio({api,escape,toast,isVisible:()=>Boolean(workspace)&&page==='studio'});
const proUI=createPro({api,escape,toast,isVisible:()=>Boolean(workspace)&&page==='pro',navigate});
const subscriptionUI=createSubscription({api,escape,toast,navigate,isVisible:()=>Boolean(workspace)&&page==='subscription'});
const sharingUI=createSharingUI({api,escape,toast,isVisible:()=>Boolean(workspace)&&page==='sharing'});
function navigate(next,model,options){if(next==='crews')next='equipes';if(page==='pro'&&next!=='pro')proUI.stop();if(page==='studio'&&next!=='studio')studioUI.stop();if(page==='chat'&&next!=='chat'){chatUI.stopVoice();chatUI.showAppTitle();}if(page==='sharing'&&next!=='sharing')sharingUI.clear();page=next;render(model,options);window.scrollTo(0,0);}
mountCommandPalette(document,{
  load:async()=>{
    try{const [chats,library]=await Promise.all([api('/chats'),api('/model-library')]);return paletteCommands({chats,models:library.installed||[]});}
    catch{return paletteCommands();}
  },
  onRun(action){
    if(action.type==='page')navigate(action.page);
    if(action.type==='chat'){chatUI.openConversation(action.id);navigate('chat');}
    if(action.type==='model'){chatUI.selectModel(action.key);navigate('chat');}
  }
});
function navItemLabel(button){const named=button.querySelector('[data-i18n]');if(named)return named.textContent.trim();return [...button.childNodes].filter(node=>node.nodeType===Node.TEXT_NODE).map(node=>node.textContent.trim()).filter(Boolean).join(' ');}
function breadcrumbLabel(){const button=[...document.querySelectorAll('nav button[data-page]')].find(item=>item.dataset.page===page&&(!item.dataset.equipesView||item.dataset.equipesView===equipesView));const group=button?.closest('[data-nav-island-group]')?.querySelector('.nav-island-trigger strong')?.textContent?.trim();const item=button?navItemLabel(button):'';return group&&item?`${group} / ${item}`:'LocalNeuron';}
function render(model,options){if(!workspace)return;document.body.dataset.page=page;document.body.classList.toggle('chat-page',page==='chat');$('#breadcrumb').textContent=breadcrumbLabel();document.querySelectorAll('button[data-page]').forEach(b=>{const on=b.dataset.page===page&&(!b.dataset.equipesView||b.dataset.equipesView===equipesView);b.classList.toggle('active',on);if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});syncNavIslands();$('#content').onclick=null;if(page==='editor'||page==='music')creativeUI.render(page).catch(e=>toast(e.message));else if(page==='wizard')experienceUI.wizard();else if(page==='team')experienceUI.team();else if(page==='equipes')equipesUI.render();else if(page==='connections')experienceUI.connections();else if(page==='photo')photoUI.render(model);else if(page==='chat')chatUI.render(model,options);else if(page==='models')modelLibrary(options);else if(page==='exo')exoUI.render().catch(e=>toast(e.message));else if(page==='server')serverModeUI.render().catch(e=>toast(e.message));else if(page==='studio')studioUI.render(model);else if(page==='sharing')sharingUI.render();else if(page==='pro')proUI.render();else if(page==='subscription')subscriptionUI.render();else settings();}
function openingProblem(message){uxUI.lock();delete document.body.dataset.plan;delete document.body.dataset.page;proUI.stop();studioUI.stop();chatUI.stopVoice();document.body.classList.remove('chat-page');workspace=null;$('#content').innerHTML=`<section class="setup">${mascotHTML("attention","welcome")}<span class="eyebrow">SUAS IAS LOCAIS</span><h1>Não foi possível abrir o cofre</h1><p class="notice warn">${escape(message)}</p>${window.colmeiaDesktop?.restoreWorkspace?'<button class="quiet" id="restore-workspace">Abrir uma pasta de dados existente</button>':''}</section>`;}
async function refresh(){workspace=await api('/workspace');const exp=await api('/experience');workspace.experience=exp;render();updateResources();subscriptionUI.update().catch(()=>{});void uxUI.refresh();}
async function showConversationFolder(){const pathEl=$('#conversation-storage-path'),errorEl=$('#conversation-storage-error'),button=$('#open-conversation-folder');if(!pathEl)return;const desktop=window.colmeiaDesktop;if(!desktop?.conversationFolder){pathEl.textContent=t('settings.conversationsUnavailable');if(button)button.hidden=true;return;}try{const result=await desktop.conversationFolder('path');if(!result?.ok||typeof result.path!=='string'||!result.path)throw new Error('path');pathEl.textContent=result.path;if(errorEl){errorEl.hidden=true;errorEl.textContent='';}}catch{pathEl.textContent=t('settings.conversationsPathError');if(button)button.disabled=true;}}
function settings(){$('#content').innerHTML=head(t('settings.eyebrow'),t('settings.title'),t('settings.subtitle'))+`<div class="panel" id="mcp-servers"></div><div class="panel" id="language-settings"><h2>${t('settings.language')}</h2><label>${t('settings.languageLabel')}<select id="language-choice"><option value="auto">${t('settings.lang.auto')}</option><option value="pt-BR">${t('settings.lang.pt')}</option><option value="en">${t('settings.lang.en')}</option></select></label><p>${t('settings.languageHelp')}</p></div><div class="panel" id="access-settings"></div><div class="panel" id="updates-settings"></div><div class="panel"><h2>${t('settings.personality')}</h2><label><input type="checkbox" id="personality-toggle"> ${t('settings.personalityToggle')}</label><p>${t('settings.personalityHelp')}</p><p id="personality-state" role="status">${t('settings.personalityLoading')}</p></div><div class="panel"><h2>${t('settings.appearance')}</h2><p>${t('settings.appearanceHelp')}</p></div>${mascotGallery()}<div class="panel"><h2>${t('settings.memory')}</h2><p data-resource-summary>${t('settings.memoryChecking')}</p><p>${t('settings.memoryHelp')}</p><button class="secondary" data-page="models">${t('settings.openModels')}</button></div><div class="panel"><h2>${t('settings.data')}</h2><p>${t('settings.dataHelp')}</p><button class="secondary" data-export-workspace>${t('settings.export')}</button> <a class="secondary" href="/v1/vault/backup" download>${t('settings.backup')}</a>${window.colmeiaDesktop?.restoreWorkspace?` <button class="quiet" id="restore-workspace">${t('settings.restore')}</button>`:''}</div><div class="panel settings-row" id="conversation-storage"><div><h2>${t('settings.conversations')}</h2><p>${t('settings.conversationsHelp')}</p><p id="conversation-storage-path" class="conversation-path">${t('settings.conversationsLoading')}</p><p id="conversation-storage-error" class="muted" role="status" hidden></p></div><button class="secondary" type="button" id="open-conversation-folder">${t('settings.conversationsOpen')}</button></div><div class="panel"><h2>${t('settings.media')}</h2><p>${t('settings.mediaHelp')}</p><button class="secondary" data-page="studio">${t('settings.openStudio')}</button></div><details class="panel"><summary>${t('settings.about')}</summary><p>${t('settings.about1')}</p><p>${t('settings.about2')}</p><p>${t('settings.about3')}</p></details>`;const language=$('#language-choice');if(language){language.value=languagePreference();language.onchange=()=>{saveLanguagePreference(language.value);const next=new URL(location.href);next.searchParams.delete('lang');location.href=next.pathname+next.search+next.hash;};}api('/personality').then(v=>{const toggle=$('#personality-toggle');if(!toggle)return;toggle.checked=v.enabled;$('#personality-state').textContent=v.enabled?t('settings.personalityOn'):t('settings.personalityOff');toggle.onchange=()=>action(toggle,async()=>{try{await api('/personality',{method:'POST',body:{enabled:toggle.checked}});$('#personality-state').textContent=toggle.checked?t('settings.personalityOn'):t('settings.personalityOff');}catch(e){toggle.checked=!toggle.checked;throw e;}});}).catch(e=>toast(e.message));void uxUI.settings();mountMcpServers({api,escape,toast,root:$('#mcp-servers')});void showConversationFolder();updateResources();}
let resourceBusy=false;
async function updateResources(){if(!workspace||resourceBusy)return;resourceBusy=true;try{const r=await api('/resources'),available=gib(r.available_memory_bytes),total=gib(r.total_memory_bytes);if(libraryStatus){libraryStatus.available_memory_bytes=r.available_memory_bytes;libraryStatus.total_memory_bytes=r.total_memory_bytes;}$('#ram-sidebar').replaceChildren(Object.assign(document.createElement('strong'),{textContent:available}),document.createTextNode(' '+t('shell.ramAvailable')),document.createElement('br'));const ramOf=document.createElement('span');ramOf.className='muted';setText(ramOf,'shell.ramOf',{total});$('#ram-sidebar').append(ramOf);document.querySelectorAll('[data-ram-available]').forEach(el=>el.textContent=available);document.querySelectorAll('[data-resource-summary]').forEach(el=>el.textContent=format('settings.memoryLine',{available,total,state:r.generation_busy?t('settings.memoryBusy'):t('settings.memoryIdle')}));document.querySelectorAll('[data-ram-needed]').forEach(el=>{const fits=r.available_memory_bytes>=(Number(el.dataset.ramNeeded)+1)*1073741824,large=Number(el.dataset.pcRam)*1073741824>r.total_memory_bytes;el.textContent=fitNote(large,fits,true);el.classList.toggle('fits',fits&&!large);el.classList.toggle('tight',!fits||large);});}catch{}finally{resourceBusy=false;}}
setInterval(updateResources,3000);
function saveFile(name,text,type='application/json'){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const gb = bytes => (bytes / (bytes>=1e12?1e12:1e9)).toLocaleString(textLocale(), {maximumFractionDigits:2}) + (bytes>=1e12?' TB':' GB');
const gib = bytes => (bytes / 1073741824).toLocaleString(textLocale(), {maximumFractionDigits:1}) + ' GiB';
const platformNames = {darwin:'macOS',win32:'Windows',linux:'Linux'};
let modelFilter='all', modelSearch='', modelPage=0, modelSort='suggested', modelFamily=FAMILY_ALL, librarySmallFirst=false;
const PAGE_SIZE=24;
const modelFavorites=new Set((()=>{try{const v=JSON.parse(localStorage.getItem('localneuron-favorites')||'[]');return Array.isArray(v)?v.filter(x=>typeof x==='string').slice(0,2000):[]}catch{return []}})());
const modelCompare=new Set();
function labeled(value){const key=categoryKey(value);return key?t(key):String(value??'');}
function embeddedSeal(label){if(label==='Motor embutido · llama.cpp')return t('models.embedded.llama');if(label==='Motor embutido · MLX')return t('models.embedded.mlx');return String(label??'');}
function fitNote(large,fits,live=false){if(large)return t('models.fit.moreRam');if(live)return fits?t('models.fit.margin'):t('models.fit.release');return fits?t('models.fit.now'):t('models.fit.free');}
function quantizeStateLabel(job){const key=QUANTIZE_STATE_KEYS[job?.state];return key?t(key):String(job?.label||'');}
function quantizeDetailLabel(detail){const key=QUANTIZE_DETAIL_KEYS[detail];return key?t(key):String(detail??'');}
function accessLabel(access){const keys={public:'models.access.public',authorized:'models.access.authorized',restricted:'models.access.restricted',missing:'models.access.missing'};return t(keys[access]||'models.access.unchecked');}
function downloadStateLabel(state){return t(state==='verifying'?'models.state.verifying':'models.state.downloading');}
function comparison(){
 const models=libraryStatus.catalog.filter(m=>modelCompare.has(m.id));if(models.length<2){toast(t('models.compare.needTwo'));return;}
 document.querySelector('#model-comparison')?.remove();const dialog=document.createElement('dialog');dialog.id='model-comparison';dialog.className='model-comparison';
 const rows=[['models.compare.use',m=>(m.categories||[]).map(labeled).join(', ')],['models.compare.download',m=>gb(m.bytes)],['models.compare.ram',m=>'~'+m.ram_gib+' GiB'],['models.compare.computerRam',m=>m.computer_ram_gib+' GiB'],['models.compare.format',m=>'GGUF '+m.quantization],['models.compare.license',m=>m.license],['models.compare.description',m=>m.description]];
 dialog.innerHTML=`<form method="dialog"><div class="dialog-head"><h2>${t('models.compare.title')}</h2><button class="icon-button" aria-label="${escape(t('models.compare.close'))}">×</button></div></form><p>${t('models.compare.intro')}</p><div class="comparison-scroll"><table><thead><tr><th>${t('models.compare.model')}</th>${models.map(m=>`<th>${escape(m.name)}</th>`).join('')}</tr></thead><tbody>${rows.map(([key,value])=>`<tr><th>${t(key)}</th>${models.map(m=>`<td>${escape(value(m))}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="muted">${t('models.compare.note')}</p>`;document.body.append(dialog);dialog.showModal();
}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.modelFavorite){const id=b.dataset.modelFavorite;modelFavorites.has(id)?modelFavorites.delete(id):modelFavorites.add(id);localStorage.setItem('localneuron-favorites',JSON.stringify([...modelFavorites]));filterModelCards();}else if(b.dataset.modelCompare){const id=b.dataset.modelCompare;if(modelCompare.has(id))modelCompare.delete(id);else if(modelCompare.size<3)modelCompare.add(id);else{toast(t('models.compare.limit'));return;}filterModelCards();}else if(b.hasAttribute('data-open-comparison'))comparison();else if(b.hasAttribute('data-clear-comparison')){modelCompare.clear();filterModelCards();}});

async function modelLibrary(options) {
  librarySmallFirst = Boolean(options?.smallLocalFirst);
  if (librarySmallFirst) { modelSort = 'small'; modelPage = 0; }
  $('#content').innerHTML = head(t('models.eyebrow'),t('models.title'),t('models.subtitle'), `<button class="secondary" data-library-refresh>${t('models.refresh')}</button>`) + `<div id="library-content"><div class="loading">${t('models.loading')}</div></div>`;
  try { await refreshLibrary(); } catch(error) { if($('#library-content')) $('#library-content').innerHTML = `<div class="notice warn">${escape(error.message)}. ${t('models.loadError')}</div>`; }
}
function presentLocalInstall(plan) {
  localInstallEffects(plan, {
    toast,
    readyMessage: () => t('chat.firstReady'),
    selectModel: (key, name) => chatUI.selectModel(key, name),
    openChat: (key, name) => navigate('chat', key, { pinModel: true, modelName: name, focusComposer: true }),
    focusComposer: () => chatUI.focusComposer(),
  });
}
async function refreshLibrary() {
  const previous = libraryStatus;
  const response = await fetch('/v1/model-library', { headers: libraryEtag ? { 'if-none-match': libraryEtag } : {} });
  if (response.status === 304) { drawLibrary(); return libraryStatus; }
  const data = await response.json();
  if (!response.ok) { if (data.code === 'pro_required') document.dispatchEvent(new CustomEvent('localneuron:pro-required', { detail: data })); throw new Error(data.error || t('shell.couldNotFinish')); }
  libraryStatus = data; libraryEtag = response.headers.get('etag');
  const plan = previous ? planLocalInstallArrival({ beforeInstalled: previous.installed, afterInstalled: data.installed, beforeJobs: new Map((previous.catalog || []).map(model => [model.id, model.job?.state || ''])), afterCatalog: data.catalog, page }) : null;
  drawLibrary();
  presentLocalInstall(plan);
  return data;
}
function paintLibraryProgress() {
  const s = libraryStatus; if (!s) return;
  const disk = document.querySelector('[data-disk-free]'); if (disk) disk.textContent = gb(s.disk_free_bytes);
  document.querySelectorAll('[data-ram-available]').forEach(el => el.textContent = gib(s.available_memory_bytes));
  document.querySelectorAll('[data-ram-needed]').forEach(el => { const fits = s.available_memory_bytes >= (Number(el.dataset.ramNeeded) + 1) * 1073741824, large = Number(el.dataset.pcRam) * 1073741824 > s.total_memory_bytes; el.textContent = fitNote(large, fits, true); el.classList.toggle('fits', fits && !large); el.classList.toggle('tight', !fits || large); });
  for (const model of s.catalog) {
    const job = model.job; if (!job?.total) continue;
    const progress = Math.min(100, Math.floor(job.downloaded / job.total * 100));
    const bar = document.querySelector(`[data-job-progress="${CSS.escape(model.id)}"]`); if (bar) bar.value = progress;
    const caption = document.querySelector(`[data-job-caption="${CSS.escape(model.id)}"]`); if (caption) caption.textContent = `${progress}% · ${gb(job.downloaded)} / ${gb(job.total)}`;
    const banner = document.querySelector(`[data-job-banner="${CSS.escape(model.id)}"]`); if (banner) banner.textContent = `${gb(job.downloaded)} / ${gb(job.total)}`;
  }
  const studio = document.querySelector('[data-studio-progress]'); if (studio && s.studio_download) studio.textContent = `${gb(s.studio_download.progress || 0)} / ${gb(s.studio_download.total)}`;
  const quantJob = s.quantize, quantBanner = document.querySelector('#quantize-banner');
  if (quantJob && quantBanner && ['preparing','imatrix','quantizing'].includes(quantJob.state)) {
    const quantProgress = Math.max(0, Math.min(100, quantJob.progress || 0));
    const quantLabel = quantBanner.querySelector('[data-quantize-label]'); if (quantLabel) quantLabel.textContent = quantizeStateLabel(quantJob);
    const quantCaption = quantBanner.querySelector('[data-quantize-caption]'); if (quantCaption) quantCaption.textContent = `${quantizeDetailLabel(quantJob.detail)} · ${quantProgress}%`;
    const quantBar = quantBanner.querySelector('[data-quantize-bar]'); if (quantBar) quantBar.value = quantProgress;
  }
  for (const job of s.media_downloads?.jobs || []) {
    const key = CSS.escape(`${job.model}:${job.file}`);
    const bar = document.querySelector(`[data-media-progress="${key}"]`); if (bar) { bar.max = job.total; bar.value = job.downloaded; }
    const caption = document.querySelector(`[data-media-caption="${key}"]`); if (caption) caption.textContent = `${gb(job.downloaded)} / ${gb(job.total)}`;
  }
}
function modelButton(command, value, label, disabled = false, primary = false) { return `<button class="${primary?'primary':'secondary'}" data-model-command="${command}" data-model-value="${escape(value)}" ${disabled?'disabled':''}>${label}</button>`; }
function familyOptions(s){
  const names=[...new Set([...s.catalog,...(s.media_catalog||[])].map(m=>m.family))].filter(Boolean).sort((a,b)=>a.localeCompare(b));
  return [`<option value="${FAMILY_ALL}" ${modelFamily===FAMILY_ALL?'selected':''}>${escape(t('models.family.all'))}</option>`,...names.map(name=>`<option value="${escape(name)}" ${modelFamily===name?'selected':''}>${escape(name)}</option>`)].join('');
}
function installedCard(m,s){
  const managed=s.catalog.find(c=>c.job?.model_key===m.key), loaded=m.loaded_instances||[], busy=s.busy||libraryBusy, estimate=managed?managed.ram_gib:Math.ceil((m.size_bytes*1.35+1073741824)/1073741824);
  const size=m.size_bytes?format('models.installed.disk',{size:gb(m.size_bytes)}):t('models.installed.unknownSize');
  const quant=m.quantization?.name?'· '+escape(m.quantization.name):'';
  const origin=m.key.startsWith('exo:')?t('models.installed.exoManaged'):managed?t('models.installed.catalog'):t('models.installed.local');
  const ram=m.size_bytes&&!m.key.startsWith('exo:')?' '+format('models.installed.ramEst',{estimate}):'';
  const engine=m.key.startsWith('exo:')?t('models.installed.exoNet'):m.key.startsWith('mlx:')?t('models.installed.mlx'):m.key.startsWith('gguf:')?t('models.installed.gguf'):t('models.installed.external');
  const badges=loaded.map(i=>{const context=i.config?.context_length?format('models.installed.context',{count:Number(i.config.context_length).toLocaleString(textLocale())}):'';return `<span class="badge validated">${t('models.installed.ready')}${context}</span>`;}).join('');
  const warn=!/^(gguf|mlx|exo):/.test(m.key)&&loaded.some(i=>(i.config?.context_length||0)>4096)?`<p class="notice warn">${t('models.installed.contextWarn')}</p>`:'';
  const actions=loaded.length?loaded.map(i=>modelButton('use',m.key,t('models.installed.chat'),false,true)+modelButton('unload',i.id,t('models.installed.unload'),busy)).join(''):modelButton('use',m.key,t('models.installed.chat'),busy,true);
  const quantize=/^(gguf|mlx):/.test(m.key)?modelButton('quantize',m.key,t('models.installed.quantize'),busy||['preparing','imatrix','quantizing'].includes(s.quantize?.state)):'';
  return `<article class="installed-model panel"><div><h3>${escape(m.display_name||m.key)}</h3><p>${size} · ${escape(m.format||t('models.installed.unknownFormat'))} ${quant}</p><p class="muted">${origin}${ram}</p><p class="muted">${engine}</p>${badges}${warn}</div><div class="actions">${actions}${quantize}</div></article>`;
}
function drawLibrary() {
  const target=$('#library-content'); if(!target || !libraryStatus) return;
  const focus=target.contains(document.activeElement)?document.activeElement:null,focusId=focus?.id,selection=focus?.tagName==='INPUT'?[focus.selectionStart,focus.selectionEnd]:null;
  const previousHub=target.querySelector('.hub-panel');
  const openModels=new Map(Array.from(target.querySelectorAll('[data-catalog-id]')).map(el=>[el.dataset.catalogId,Array.from(el.querySelectorAll('details')).map(d=>d.open)]));
  const s=libraryStatus, native=s.integrated_available||s.api==='lmstudio', busy=s.busy||libraryBusy;
  const installedModels=librarySmallFirst?sortSmallLocalFirst(s.installed,s.catalog):s.installed;
  const checkedAt=s.access_summary?.checked_at?new Date(s.access_summary.checked_at).toLocaleDateString(textLocale()):t('models.access.unknownDate');
  const mediaCount=(s.media_catalog||[]).length;
  target.innerHTML = `<div class="machine-strip"><div><span class="eyebrow">${t('models.machine.eyebrow')}</span><strong>${format('models.machine.ram',{platform:platformNames[s.platform]||escape(s.platform),ram:gib(s.total_memory_bytes)})}</strong></div><div><span>${t('models.machine.available')}</span><strong data-ram-available>${gib(s.available_memory_bytes)}</strong></div><div><span>${t('models.machine.disk')}</span><strong data-disk-free>${gb(s.disk_free_bytes)}</strong></div><span class="badge ${native?'validated':'paused'}">${s.integrated_available?t('models.machine.ready'):native?t('models.machine.availableEngines'):t('models.machine.setup')}</span></div>
    ${starterSuggestionHtml(s.starter, escape)}
    ${!native?`<div class="panel engine-onboarding"><div><span class="eyebrow">${t('models.onboarding.eyebrow')}</span><h2>${t('models.onboarding.title')}</h2><p>${t('models.onboarding.body')}</p><p class="muted">${t('models.onboarding.hint')}</p></div><div class="actions"><a class="secondary" href="https://lmstudio.ai/download" target="_blank" rel="noreferrer">${t('models.onboarding.getLm')}</a>${modelButton('engine','',t('models.onboarding.prepare'),!s.lms_available||busy,true)}</div></div>`:''}
    ${busy?`<div class="notice" role="status">${t('models.preparing')}</div>`:''}<details class="library-help"><summary>${t('models.guide.summary')}</summary><div class="library-guide"><div><b>01</b><strong>${t('models.guide.choose')}</strong><span>${t('models.guide.chooseHint')}</span></div><div><b>02</b><strong>${t('models.guide.download')}</strong><span>${t('models.guide.downloadHint')}</span></div><div><b>03</b><strong>${t('models.guide.use')}</strong><span>${t('models.guide.useHint')}</span></div></div></details>
    ${s.catalog.filter(m=>['downloading','verifying'].includes(m.job?.state)).map(m=>`<div class="download-active notice" role="status"><strong>${escape(m.name)} · ${downloadStateLabel(m.job.state)}</strong><span data-job-banner="${escape(m.id)}">${gb(m.job.downloaded)} / ${gb(m.job.total)}</span><div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${m.job.total?Math.min(100,Math.round(m.job.downloaded*100/m.job.total)):0}"><span style="width:${m.job.total?Math.min(100,Math.round(m.job.downloaded*100/m.job.total)):0}%"></span></div>${modelButton('cancel',m.id,t('models.pauseDownload'),m.job.state!=='downloading')}</div>`).join('')}
    ${s.studio_download?.state==='downloading'?`<div class="notice"><strong>${t('models.installingVisual')}</strong><span data-studio-progress>${gb(s.studio_download.progress||0)} / ${gb(s.studio_download.total)}</span><button class="secondary" data-pause-visual>${t('models.pauseInstall')}</button></div>`:''}${s.studio_download?.error?`<div class="notice warn">${escape(s.studio_download.error)}</div>`:''}<div class="section-line"><h2>${t('models.catalog.title')}</h2><span class="muted">${format('models.catalog.summary',{text:s.catalog.length,media:mediaCount})}</span></div>
    <div class="library-search"><input id="model-search" placeholder="${escape(t('models.search.placeholder'))}" aria-label="${escape(t('models.search.label'))}" value="${escape(modelSearch)}"><div class="model-filters">${MODEL_FILTERS.map(filter=>`<button class="${modelFilter===filter.id?'selected':''}" data-model-filter="${filter.id}">${escape(t(filter.key))}</button>`).join('')}</div><div class="catalog-selects"><label>${t('models.family.label')}<select id="model-family">${familyOptions(s)}</select></label><label>${t('models.sort.label')}<select id="model-sort">${Object.entries({suggested:'models.sort.suggested',small:'models.sort.small',large:'models.sort.large',name:'models.sort.name'}).map(([id,key])=>`<option value="${id}" ${modelSort===id?'selected':''}>${escape(t(key))}</option>`).join('')}</select></label></div></div>
    <div class="notice"><div><strong>${format('models.access.verified',{count:s.access_summary?.public||0})}</strong><p>${format('models.access.body',{date:checkedAt,unsupported:s.access_summary?.unsupported||0})}</p></div></div>${hubUI.html()}<div id="catalog-results"></div>
    <details class="panel"><summary>${t('models.faq.summary')}</summary><p>${format('models.faq.body',{text:s.catalog.length,media:mediaCount})}</p><p>${t('models.faq.more')}</p></details><div class="notice"><div><strong>${t('models.ram.title')}</strong><br>${t('models.ram.body')}</div></div>
    ${quantizeBanner(s)}<div class="section-line"><h2>${t('models.installed.title')} <span class="muted">/ ${s.installed.length}</span></h2></div><div class="installed-models">${installedModels.length?installedModels.map(m=>installedCard(m,s)).join(''):`<div class="panel"><p>${t('models.installed.empty')}</p></div>`}</div>
    ${s.platform==='win32'?`<div class="notice"><strong>${t('models.windows.title')}</strong><p>${t('models.windows.body')}</p><a href="https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist" target="_blank" rel="noreferrer">${t('models.windows.link')}</a></div>`:''}<details class="panel"><summary>${t('models.platforms.summary')}</summary><p>${t('models.platforms.body')}</p><p>${t('models.platforms.engine')}</p><a href="https://lmstudio.ai/docs/app/system-requirements" target="_blank" rel="noreferrer">${t('models.platforms.link')}</a></details>`;
  if(previousHub)target.querySelector('.hub-panel')?.replaceWith(previousHub);
  if(librarySmallFirst&&s.installed.length){
    const installed=target.querySelector('.installed-models');
    const heading=installed?.previousElementSibling;
    const catalog=target.querySelector('.section-line');
    if(installed&&heading?.classList.contains('section-line')&&catalog&&catalog!==heading)catalog.before(heading,installed);
  }
  filterModelCards();
  target.querySelectorAll('[data-catalog-id]').forEach(card=>{const opened=openModels.get(card.dataset.catalogId);if(opened)card.querySelectorAll('details').forEach((d,i)=>d.open=Boolean(opened[i]));});
  if(focusId&&document.getElementById(focusId)){const restored=document.getElementById(focusId);restored.focus({preventScroll:true});if(selection)restored.setSelectionRange(...selection);}
}
function textModelCard(m,s){
 const native=s.integrated_available||s.api==='lmstudio',downloading=s.catalog.some(item=>['downloading','verifying'].includes(item.job?.state)),busy=s.busy||libraryBusy;
 const job=m.job, localKey=m.local_key||job?.model_key;
 const progress=job?Math.min(100,Math.floor(job.downloaded/job.total*100)):0;
 let control;
 if(job?.state==='downloading'||job?.state==='verifying') control=`<progress data-job-progress="${escape(m.id)}" max="100" value="${progress}" aria-label="${escape(format('models.card.downloadAria',{name:m.name}))}"></progress><div class="download-caption"><span data-job-caption="${escape(m.id)}">${progress}% · ${gb(job.downloaded)} / ${gb(job.total)}</span>${modelButton('cancel',m.id,t('models.pause'),job.state!=='downloading')}</div>`;
 else if(localKey&&s.installed.some(i=>i.key===localKey)) control=modelButton('use',localKey,t('models.installed.chat'),!native||busy,true);
 else if(['downloaded','indexing'].includes(job?.state)||(job?.state==='failed'&&(m.downloaded_file||job.downloaded===m.bytes))) control=modelButton('talk',m.id,t('models.card.installTalk'),!native||busy,true);
 else if(job?.state==='importing') control=`<p role="status">${t('models.card.adding')}</p>`;
 else if(localKey&&s.installed.some(i=>i.key===localKey)) control=modelButton('use',localKey,t('models.installed.chat'),!native||busy,true);
 else control=modelButton('download',m.id,job?.state==='failed'||job?.state==='cancelled'?t('models.card.continue'):format('models.card.download',{size:gb(m.bytes)}),downloading||busy,true);
 const availability=m.availability,unsupported=availability?.support?.status==='unsupported';
 if(unsupported)control=`<p class="notice warn">${t('models.card.unsupported')}</p>`;
 return `<article class="model-card" data-catalog-id="${escape(m.id)}" data-model-search="${escape((m.name+' '+m.family+' '+m.author+' '+m.description+' '+m.tag).toLocaleLowerCase('pt-BR'))}"><div class="model-purpose">${(m.categories||[m.tag]).map(c=>`<span>${escape(labeled(c))}</span>`).join('')}</div><div class="model-card-actions"><button class="quiet" data-model-favorite="${escape(m.id)}" aria-pressed="${modelFavorites.has(m.id)}" aria-label="${escape(format(modelFavorites.has(m.id)?'models.favorite.removeAria':'models.favorite.addAria',{name:m.name}))}">${icon('star')}${modelFavorites.has(m.id)?t('models.favorite.on'):t('models.favorite.add')}</button><button class="quiet" data-model-compare="${escape(m.id)}" aria-pressed="${modelCompare.has(m.id)}">${icon('compare')}${modelCompare.has(m.id)?t('models.compare.comparing'):t('models.compare.action')}</button></div><div class="model-card-top">${modelIcon(m)}<span class="tag">${escape(m.tag)}</span>${m.embedded?.runs?`<span class="tag embedded-seal">${escape(embeddedSeal(m.embedded.label))}</span>`:''}</div><h3>${escape(m.name)}</h3><span class="muted">${escape(m.family)} · ${escape(m.author)}</span><p class="model-description">${escape(m.description)}</p><p class="muted">${accessLabel(availability?.access)} · ${escape(availability?.support?.architecture||t('models.card.archUnknown'))}</p><div class="model-numbers"><div><span>${t('models.card.downloadLabel')}</span><strong>${gb(m.bytes)}</strong></div><div><span>${t('models.card.ramLabel')}</span><strong>${format('models.card.ramValue',{ram:m.ram_gib})}</strong></div></div><p data-ram-needed="${m.ram_gib}" data-pc-ram="${m.computer_ram_gib}" class="fit-note ${m.fits_now?'fits':'tight'}">${fitNote(m.computer_ram_gib*1073741824>s.total_memory_bytes,Boolean(m.fits_now))}</p><p class="muted">${format('models.card.suggested',{ram:m.computer_ram_gib})}</p><div class="model-control">${control}</div>${job?.error&&!localKey?`<p class="download-error" role="status">${escape(job.error)}</p>${job.state==='failed'?modelButton('download',m.id,t('models.card.continue'),downloading||busy):''}`:''}<details class="model-details"><summary>${t('models.card.about')}</summary><p>${escape(m.limitation)}</p><p>${escape(availability?.support?.reason)}</p>${availability?.error?`<p class="notice warn">${escape(availability.error)}</p>`:''}${modelButton('check',m.id,t('models.card.check'),busy)}<p class="muted">${format('models.card.linkNote',{repo:escape(m.repo)})}</p><dl><dt>${t('models.card.format')}</dt><dd>GGUF · ${escape(m.quantization)}${m.parts?.length>1?format('models.card.parts',{count:m.parts.length}):''}</dd><dt>${t('models.card.license')}</dt><dd>${escape(m.license)}</dd><dt>${t('models.card.publisher')}</dt><dd>${escape(m.publisher)}</dd><dt>${t('models.card.context')}</dt><dd>${m.context_limit?format('models.card.contextLimit',{count:m.context_limit.toLocaleString(textLocale())}):''}${t('models.card.contextRest')}</dd><dt>${t('models.card.compat')}</dt><dd>${t('models.card.compatValue')}</dd><dt>${t('models.card.alpha')}</dt><dd>${t('models.card.alphaValue')}</dd><dt>${t('models.card.integrity')}</dt><dd>${t('models.card.integrityValue')}</dd></dl>${m.parts?.length>1?`<p>${format('models.card.partsNote',{count:m.parts.length})}</p>`:''}<p class="monospace">${m.sha256}</p>${m.base_model?`<a href="https://huggingface.co/${escape(m.base_model)}" target="_blank" rel="noreferrer">${t('models.card.original')}</a><br>`:''}<a href="${escape(m.source)}" target="_blank" rel="noreferrer">${t('models.card.published')}</a></details></article>`;
}
function filterModelCards() {
 const target=$('#catalog-results'),s=libraryStatus;if(!target||!s)return;
 const normalize=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
 const query=normalize(modelSearch).trim();
 let matches=[...s.catalog,...(s.media_catalog||[])].filter(m=>
 (modelFamily===FAMILY_ALL||m.family===modelFamily)&&
 modelMatchesFilter(m,modelFilter,s,modelFavorites)&&
 normalize([m.name,m.author,m.family,m.description,...(m.categories||[])].join(' ')).includes(query));
 if(librarySmallFirst)matches=sortSmallLocalFirst(matches,s.catalog);
 else if(modelSort==='small'||modelSort==='large')matches.sort((a,b)=>Number(Boolean(a.external))-Number(Boolean(b.external))||(modelSort==='small'?1:-1)*((a.bytes||a.files?.[0]?.bytes||0)-(b.bytes||b.files?.[0]?.bytes||0)));
 else if(modelSort==='name')matches.sort((a,b)=>a.name.localeCompare(b.name));
 const pages=Math.max(1,Math.ceil(matches.length/PAGE_SIZE));modelPage=Math.min(modelPage,pages-1);const start=modelPage*PAGE_SIZE;
 const emptyAction=matches.length?null:emptyCatalogAction(modelFilter,query,modelFamily);
 const emptyButton=emptyAction?`<button type="button" class="secondary" data-model-filter="${emptyAction.filterId}">${escape(t(emptyAction.labelKey))}</button>`:'';
 target.innerHTML=`${modelCompare.size?`<div class="comparison-bar"><span>${format('models.compare.selected',{count:modelCompare.size})}</span><button class="secondary" data-open-comparison ${modelCompare.size<2?'disabled':''}>${t('models.compare.open')}</button><button class="quiet" data-clear-comparison>${t('models.compare.clear')}</button></div>`:''}<div class="catalog-count"><p id="model-count" role="status">${matches.length?format('models.results.count',{count:matches.length,from:start+1,to:Math.min(start+PAGE_SIZE,matches.length)}):t(emptyCatalogMessageKey(modelFilter,query,modelFamily))}</p><span class="muted">${format('models.results.entries',{count:s.catalog.length+(s.media_catalog?.length||0)})}</span></div>${emptyButton}${isVisualFilter(modelFilter)?`<div class="notice">${t('models.results.visual')}</div>`:''}<div class="model-grid">${matches.slice(start,start+PAGE_SIZE).map(m=>m.external?mediaModelCard(m,s):textModelCard(m,s)).join('')}</div>${pages>1?`<nav class="catalog-pagination" aria-label="${escape(t('models.page.nav'))}"><button class="secondary" data-model-page="${modelPage-1}" ${modelPage===0?'disabled':''}>${t('models.page.prev')}</button><span>${format('models.page.status',{page:modelPage+1,pages})}</span><button class="secondary" data-model-page="${modelPage+1}" ${modelPage===pages-1?'disabled':''}>${t('models.page.next')}</button></nav>`:''}`;
}
document.addEventListener('input',event=>{if(event.target.id==='model-search'){modelSearch=event.target.value;modelPage=0;filterModelCards();}});
document.addEventListener('change',event=>{if(event.target.id==='model-sort'){const restore=librarySmallFirst;librarySmallFirst=false;modelSort=event.target.value;modelPage=0;if(restore)drawLibrary();else filterModelCards();}if(event.target.id==='model-family'){modelFamily=event.target.value;modelPage=0;filterModelCards();}});
document.addEventListener('click',event=>{const b=event.target.closest('[data-model-page]');if(b){modelPage=Math.max(0,Number(b.dataset.modelPage));filterModelCards();$('.library-search').scrollIntoView({block:'start'});}});
const quantizePresetDetails={GGUF:{equilibrado:'GGUF Q4_K_M · imatrix',menor:'GGUF IQ4_XS · imatrix',qualidade:'GGUF Q6_K'},MLX:{equilibrado:'MLX 4 bits · grupo 64',menor:'MLX 4 bits · grupo 128',qualidade:'MLX misto 4 e 6 bits'}};
let quantizeTimer;
function quantizeBanner(s){
  const job=s.quantize;if(!job)return '';
  const progress=Math.max(0,Math.min(100,job.progress||0));
  const label=escape(quantizeStateLabel(job));
  const detail=escape(quantizeDetailLabel(job.detail));
  if(['preparing','imatrix','quantizing'].includes(job.state))return `<div class="notice" id="quantize-banner" role="status"><strong data-quantize-label>${label}</strong><span data-quantize-caption>${detail} · ${progress}%</span><progress data-quantize-bar max="100" value="${progress}"></progress><button class="secondary" type="button" data-quantize-cancel>${t('models.quantize.cancel')}</button></div>`;
  if(job.state==='failed'||job.state==='cancelled')return `<div class="notice warn" role="status"><strong>${label}</strong><p>${escape(job.error||quantizeStateLabel(job))}</p><button class="secondary" type="button" data-quantize-clear>${t('models.quantize.dismiss')}</button></div>`;
  if(job.state==='done')return `<div class="notice" role="status"><strong>${label}</strong><p>${format('models.quantize.kept',{detail,suffix:job.output_name?' · '+escape(job.output_name):''})}</p><button class="secondary" type="button" data-quantize-clear>${t('models.quantize.dismiss')}</button></div>`;
  return '';
}
function selectedQuantizePreset(){return document.querySelector('#quantize-model input[name="quantize-preset"]:checked')?.value||'equilibrado';}
function paintQuantizeJob(job){
  const progress=Math.max(0,Math.min(100,Number(job?.progress)||0)),running=Boolean(job&&['preparing','imatrix','quantizing'].includes(job.state));
  const box=$('#quantize-progress');
  if(box){box.hidden=!running&&job?.state!=='done';const bar=box.querySelector('progress');if(bar)bar.value=progress;const label=$('#quantize-progress-label');if(label)label.textContent=job?.state==='done'?format('models.quantize.keptShort',{label:quantizeStateLabel(job)}):`${quantizeStateLabel(job)} · ${progress}%`;}
  const start=$('#quantize-start'),cancel=$('#quantize-cancel');
  if(start)start.hidden=running;
  if(cancel)cancel.hidden=!running;
  const error=$('#quantize-error');
  if(error)error.textContent=job?.state==='failed'||job?.state==='cancelled'?job.error||quantizeStateLabel(job):'';
  if(libraryStatus)libraryStatus.quantize=job;
}
async function loadQuantizeEstimate(){
  const dialog=$('#quantize-model');if(!dialog?.dataset.key)return;
  const preset=selectedQuantizePreset();
  const estimate=await api('/model-library/quantize/estimate',{method:'POST',body:{key:dialog.dataset.key,preset}});
  const host=$('#quantize-estimate');
  if(host)host.innerHTML=estimate.output_bytes?`<div class="quantize-estimate"><div><span>${t('models.quantize.predicted')}</span><strong>~${gb(estimate.output_bytes)}</strong></div><div><span>${t('models.quantize.ramUse')}</span><strong>~${gib(estimate.ram_bytes)}</strong></div></div><p class="muted">${escape(estimate.note||'')}</p>`:`<p class="muted">${escape(estimate.note||t('models.quantize.estimateFail'))}</p>`;
  const detail=dialog.querySelector(`[data-preset="${preset}"]`);if(detail&&estimate.detail)detail.textContent=quantizeDetailLabel(estimate.detail);
  const error=$('#quantize-error');
  if(error && !['preparing','imatrix','quantizing'].includes(libraryStatus?.quantize?.state))error.textContent=estimate.error||'';
  const start=$('#quantize-start');if(start)start.disabled=!estimate.eligible;
}
async function openQuantize(key){
  const dialog=$('#quantize-model'),model=libraryStatus?.installed?.find(item=>item.key===key),format=key.startsWith('mlx:')?'MLX':'GGUF',details=quantizePresetDetails[format];
  dialog.dataset.key=key;
  $('#quantize-model-title').textContent=model?.display_name||t('models.quantize.installed');
  $('#quantize-error').textContent='';
  $('#quantize-progress').hidden=true;
  $('#quantize-start').hidden=false;
  $('#quantize-cancel').hidden=true;
  $('#quantize-model-body').innerHTML=`<fieldset class="quantize-presets"><legend class="sr-only">${t('models.quantize.legend')}</legend>${[['equilibrado','models.quantize.balanced'],['menor','models.quantize.smaller'],['qualidade','models.quantize.quality']].map(([id,label],index)=>`<label class="quantize-preset"><input type="radio" name="quantize-preset" value="${id}" ${index===0?'checked':''}><span><strong>${t(label)}</strong><small data-preset="${id}">${escape(quantizeDetailLabel(details[id]))}</small></span></label>`).join('')}</fieldset><div id="quantize-estimate"><p class="muted">${t('models.quantize.estimating')}</p></div>`;
  dialog.showModal();
  try{await loadQuantizeEstimate();}catch(error){$('#quantize-error').textContent=error.message;const start=$('#quantize-start');if(start)start.disabled=true;}
  try{const job=await api('/model-library/quantize');if(job&&['preparing','imatrix','quantizing'].includes(job.state)){paintQuantizeJob(job);pollQuantize();}}catch{}
}
function pollQuantize(){
  clearTimeout(quantizeTimer);
  if(!$('#quantize-model')?.open)return;
  quantizeTimer=setTimeout(async()=>{
    if(!$('#quantize-model')?.open)return;
    try{const job=await api('/model-library/quantize');paintQuantizeJob(job);if(job&&['preparing','imatrix','quantizing'].includes(job.state))pollQuantize();else await refreshLibrary();}
    catch(error){const alert=$('#quantize-error');if(alert)alert.textContent=error.message;}
  },800);
}
async function libraryCommand(command,value){
 if(command==='use'){navigate('chat',value);return;}
 if(command==='quantize'){await openQuantize(value);return;}
 if(command==='download'){if(!libraryStatus)libraryStatus=await api('/model-library');const model=libraryStatus.catalog.find(m=>m.id===value);if(!model)throw new Error(t('models.download.missing'));const files=model.parts?format('models.download.parts',{count:model.parts.length}):t('models.download.file');$('#download-model-body').innerHTML=`<h3>${escape(model.name)}</h3><p>${format('models.download.disk',{size:gb(model.bytes),ram:model.ram_gib})}</p>${model.computer_ram_gib*1073741824>libraryStatus.total_memory_bytes?`<p class="notice warn">${t('models.download.ramWarn')}</p>`:''}<p>${format('models.download.source',{files,publisher:escape(model.publisher),license:escape(model.license)})}</p><p class="muted">${t('models.download.note')}</p>`;$('#download-model-form').dataset.model=value;$('#download-model').showModal();return;}
 libraryBusy=true;drawLibrary();try{if(command==='talk'){await api('/model-library/install',{method:'POST',body:{id:value}});await refreshLibrary();const model=libraryStatus.catalog.find(m=>m.id===value);if(!model.local_key)throw new Error(t('models.indexing'));return;}const body=command==='engine'?{}:command==='load'?{key:value}:command==='unload'?{instance:value}:{id:value};const result=await api('/model-library/'+command,{method:'POST',body});await refreshLibrary();toast(result.error||result.warning||(command==='check'?format('models.toast.access',{access:result.access,ok:result.files_accessible,total:result.files_total}):command==='unload'?t('models.toast.unloaded'):t('models.toast.ready')));}finally{libraryBusy=false;drawLibrary();updateResources();}
}
document.addEventListener('click',async event=>{const button=event.target.closest('button');if(!button)return;if(button.dataset.navIsland){toggleNavIsland(button.dataset.navIsland);return;}if(button.dataset.theme){theme=button.dataset.theme;localStorage.setItem('colmeia-theme',theme);applyTheme();return;}if(button.hasAttribute('data-close')){button.closest('dialog').close();return;}if(button.id==='restore-workspace'){await action(button,()=>window.colmeiaDesktop.restoreWorkspace());return;}if(button.id==='open-conversation-folder'){await action(button,async()=>{const errorEl=$('#conversation-storage-error');const result=await window.colmeiaDesktop.conversationFolder('open');if(result?.ok&&typeof result.path==='string'&&result.path){const pathEl=$('#conversation-storage-path');if(pathEl)pathEl.textContent=result.path;if(errorEl){errorEl.hidden=true;errorEl.textContent='';}return;}if(errorEl){errorEl.hidden=false;errorEl.textContent=t('settings.conversationsMissing');}});return;}if(!workspace)return;if(button.dataset.equipesView)equipesView=button.dataset.equipesView;if(button.dataset.page){navigate(button.dataset.page);return;}if(button.dataset.modelCommand)await action(button,()=>libraryCommand(button.dataset.modelCommand,button.dataset.modelValue));else if(button.hasAttribute('data-library-refresh'))await action(button,refreshLibrary);else if(button.hasAttribute('data-model-filter')){modelFilter=button.dataset.modelFilter;modelPage=0;drawLibrary();}else if(button.hasAttribute('data-export-workspace'))await action(button,async()=>{saveFile('localneuron-dados-locais.json',JSON.stringify(await api('/workspace'),null,2));toast('Exportação preparada.');});});
document.addEventListener('submit',async event=>{const form=event.target;if(!['download-model-form','quantize-model-form'].includes(form.id))return;event.preventDefault();await action(form.querySelector('[type="submit"]'),async()=>{if(form.id==='quantize-model-form'){const job=await api('/model-library/quantize',{method:'POST',body:{key:$('#quantize-model').dataset.key,preset:selectedQuantizePreset()}});paintQuantizeJob(job);drawLibrary();pollQuantize();}else{await api('/model-library/download',{method:'POST',body:{id:form.dataset.model}});$('#download-model').close();await refreshLibrary();}});});
document.addEventListener('change',event=>{if(event.target?.name==='quantize-preset'&&!['preparing','imatrix','quantizing'].includes(libraryStatus?.quantize?.state))loadQuantizeEstimate().catch(error=>{$('#quantize-error').textContent=error.message;});});
document.addEventListener('click',async event=>{const button=event.target.closest('[data-quantize-cancel],#quantize-cancel,[data-quantize-clear]');if(!button)return;await action(button,async()=>{if(button.hasAttribute('data-quantize-clear')){await api('/model-library/quantize/clear',{method:'POST',body:{}});if(libraryStatus)libraryStatus.quantize=null;drawLibrary();return;}const job=await api('/model-library/quantize/cancel',{method:'POST',body:{}});paintQuantizeJob(job);await refreshLibrary();});});
setInterval(async()=>{const quantizing=['preparing','imatrix','quantizing'].includes(libraryStatus?.quantize?.state);if(workspace&&(page==='models'||page==='chat')&&(libraryStatus?.catalog.some(m=>['downloading','verifying','importing','indexing'].includes(m.job?.state))||libraryStatus?.media_downloads?.busy||libraryStatus?.studio_download?.state==='downloading'||quantizing)&&!libraryBusy&&!document.querySelector('dialog[open]')){try{const progress=await api('/model-library/progress');const merged=mergeLibraryProgress(libraryStatus,progress);if(merged.refreshCatalog)await refreshLibrary();else{libraryStatus=merged.status;paintLibraryProgress();if(quantizing&&!['preparing','imatrix','quantizing'].includes(libraryStatus.quantize?.state))await refreshLibrary();}}catch{}}},2500);
try{const token=new URLSearchParams(location.hash.slice(1)).get('session');if(token){await api('/session',{method:'POST',headers:{authorization:'Bearer '+token},body:{}});history.replaceState(null,'',location.pathname+location.search);}page='chat';if(window.colmeiaDesktop?.localAccess){const opened=await window.colmeiaDesktop.localAccess('open');if(opened?.ok)await refresh();else openingProblem(opened?.error||'Não foi possível abrir o cofre.');}else{let status=await api('/status');if(status.locked&&status.needs_migration){await api('/vault/skip-legacy',{method:'POST',body:{}});status=await api('/status');}if(!status.locked)await refresh();else openingProblem('Não foi possível abrir o cofre neste computador.');}}catch(error){openingProblem(error.message);}

document.addEventListener('change',e=>{if(e.target.dataset.mediaFile){const id=e.target.dataset.mediaFile;selectedMediaFiles.set(id,Number(e.target.value));const old=e.target.closest('[data-catalog-id]'),m=libraryStatus.media_catalog.find(m=>m.id===id);old.outerHTML=mediaModelCard(m,libraryStatus);const card=document.querySelector(`[data-catalog-id="${id}"]`);card.querySelector('.media-files').open=true;card.querySelector('select').focus();}});
document.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b||!workspace)return;if(b.dataset.openVisual)return navigate('studio',b.dataset.openVisual);if(b.dataset.installVisual)await action(b,async()=>{await api('/local-engines/download',{method:'POST',body:{id:b.dataset.installVisual}});await refreshLibrary();toast(t('models.toast.visualStarted'));});else if(b.dataset.downloadMedia)await action(b,async()=>{await api('/media-downloads',{method:'POST',body:{model:b.dataset.downloadMedia,file:Number(b.dataset.fileIndex)}});await refreshLibrary();toast(t('models.toast.fileStarted'));});else if(b.hasAttribute('data-pause-visual'))await action(b,async()=>{await api('/local-engines/cancel-download',{method:'POST',body:{}});await refreshLibrary();});else if(b.hasAttribute('data-pause-media'))await action(b,async()=>{await api('/media-downloads/pause',{method:'POST',body:{}});await refreshLibrary();});});
