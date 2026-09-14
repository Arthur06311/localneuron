const mic='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg>';
const stopIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="3"/></svg>';
export function createVoice({api,toast,escape,insert,isVisible,captureTarget}){
 let recorder=null,starting=false,transcribing=false,dialog=null,poll=null,tick=null,attempt=0,retry=null;
 let model=localStorage.getItem('colmeia-voice-choice-v2')||'whisper-small';
 let language=localStorage.getItem('colmeia-voice-language')||'pt';
 const $=s=>document.querySelector(s);
 function paint(){
  const b=$('[data-chat-voice]');if(!b)return;
  b.innerHTML=recorder?stopIcon:starting||transcribing?'<span class="voice-spinner"></span>':mic;
  const label=recorder?'Terminar gravação':transcribing?'Transcrevendo sua fala':starting?'Abrindo microfone':'Gravar mensagem';
  b.title=label;b.setAttribute('aria-label',label);b.setAttribute('aria-pressed',String(Boolean(recorder)));b.disabled=starting||transcribing;b.classList.toggle('recording',Boolean(recorder));
  const panel=$('[data-voice-panel]');if(!panel)return;panel.hidden=!(recorder||starting||transcribing||retry);
  if(!panel.hidden){
   const seconds=recorder?Math.min(85,Math.floor((Date.now()-recorder.at)/1000)):0;
   const label=recorder?`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')} / 1:25`:transcribing?'Transcrevendo no seu computador…':starting?'Preparando microfone…':'Áudio preservado para tentar novamente';
   panel.querySelector('[data-voice-time]').textContent=label;
   panel.querySelector('[data-voice-discard]').hidden=starting||transcribing;
   panel.querySelector('[data-voice-retry]').hidden=!retry||transcribing;
   panel.querySelector('.voice-wave').hidden=!recorder;
   panel.querySelector('[data-voice-hint]').textContent=recorder?'Fale normalmente. Toque no quadrado para terminar.':retry&&!transcribing?'Você pode tentar a mesma gravação novamente ou descartá-la.':'O texto aparecerá na mensagem para você revisar.';
   if(recorder){const amp=Math.min(1,recorder.level*12);panel.querySelectorAll('.voice-wave i').forEach((bar,i)=>bar.style.height=(4+amp*(12+14*Math.abs(Math.sin(Date.now()/160+i))))+'px');}
  }
 }
 async function models(){
  clearInterval(poll);poll=null;const status=await api('/local-engines');dialog?.remove();dialog=document.createElement('dialog');dialog.className='voice-dialog';document.body.append(dialog);
  dialog.innerHTML=`<form method="dialog"><div class="dialog-head"><h2>Sua voz, em texto</h2><button class="icon-button" aria-label="Fechar">×</button></div></form><p>Transcrição neste computador. O áudio não sai para a nuvem. Escolha a precisão e o idioma que você fala.</p><label>Idioma da fala<select data-voice-language>${[['pt','Português'],['auto','Detectar automaticamente'],['en','Inglês'],['es','Espanhol']].map(([v,t])=>`<option value="${v}" ${language===v?'selected':''}>${t}</option>`).join('')}</select></label><div class="voice-models">${status.models.filter(m=>m.kind==='speech').map(m=>`<section class="panel"><h3>${escape(m.name)} ${m.id==='whisper-small'?'<span class="tag">Recomendado</span>':''}</h3><p>${escape(m.description)}</p><p>${(m.bytes/1e6).toFixed(0)} MB de download · ~${m.ram_gib} GiB de RAM</p><button class="secondary" data-voice-model="${m.id}" data-installed="${m.installed}" ${!m.available?'disabled':''}>${m.installed?(m.id===model?'Selecionado':'Usar este modelo'):'Baixar e usar'}</button></section>`).join('')}</div><p data-voice-download role="status"></p><button class="secondary" data-voice-cancel hidden>Cancelar download</button><p class="muted">Small prioriza precisão; Tiny usa menos memória. O resultado depende do áudio. Fale perto do microfone, em um ambiente tranquilo.</p>`;
  dialog.addEventListener('change',e=>{if(e.target.matches('[data-voice-language]')){language=e.target.value;localStorage.setItem('colmeia-voice-language',language);}});
  const update=async()=>{const s=await api('/local-engines'),job=s.download,downloading=job?.state==='downloading';dialog.querySelector('[data-voice-download]').textContent=job?.error||(downloading?`Baixando: ${Math.floor(100*(job.progress||0)/(job.total||1))}%`:'');dialog.querySelector('[data-voice-cancel]').hidden=!downloading;dialog.querySelectorAll('[data-voice-model]').forEach(b=>b.disabled=downloading||!s.models.find(m=>m.id===b.dataset.voiceModel)?.available);if(!downloading){clearInterval(poll);poll=null;if(job?.state==='installed'&&s.models.some(m=>m.id===job.model&&m.kind==='speech')){model=job.model;localStorage.setItem('colmeia-voice-choice-v2',model);dialog.close();toast('Voz pronta. Toque no microfone para gravar.');}}};
  dialog.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;try{
   if(b.hasAttribute('data-voice-cancel')){await api('/local-engines/cancel-download',{method:'POST',body:{}});await update();return;}
   if(!b.dataset.voiceModel)return;
   if(b.dataset.installed==='true'){model=b.dataset.voiceModel;localStorage.setItem('colmeia-voice-choice-v2',model);dialog.close();toast('Configuração de voz salva.');return;}
   dialog.querySelectorAll('[data-voice-model]').forEach(x=>x.disabled=true);await api('/local-engines/download',{method:'POST',body:{id:b.dataset.voiceModel}});await update();if(!poll&&dialog.open)poll=setInterval(()=>update().catch(e=>toast(e.message)),1200);
  }catch(e){toast(e.message);b.disabled=false;}});
  dialog.addEventListener('close',()=>{clearInterval(poll);poll=null;},{once:true});dialog.showModal();
  if(status.download?.state==='downloading'){await update();poll=setInterval(()=>update().catch(()=>{}),1200);}
 }
 async function transcribe(record){
  transcribing=true;retry=record;paint();try{const result=await api('/local-engines/transcribe',{method:'POST',body:{model:record.model,language:record.language,audio:record.audio}});insert(result.text,record.target);retry=null;toast(result.warnings?.[0]||'Texto pronto. Revise sua mensagem antes de enviar.');}catch(e){toast(e.message);}finally{transcribing=false;paint();}
 }
 async function finish(discard=false){
  const r=recorder;if(!r)return;recorder=null;clearTimeout(r.timer);clearInterval(tick);r.stream.getTracks().forEach(t=>t.stop());r.node.disconnect();await r.context.close();paint();if(discard){toast('Gravação descartada.');return;}
  transcribing=true;paint();try{
   const total=r.chunks.reduce((n,c)=>n+c.length,0);if(total<r.rate*.25)throw new Error('Grave um pouco mais antes de terminar.');
   const offline=new OfflineAudioContext(1,Math.ceil(total*16000/r.rate),16000),buffer=offline.createBuffer(1,total,r.rate);let offset=0;for(const chunk of r.chunks){buffer.getChannelData(0).set(chunk,offset);offset+=chunk.length;}
   const source=offline.createBufferSource();source.buffer=buffer;source.connect(offline.destination);source.start();const rendered=await offline.startRendering(),samples=rendered.getChannelData(0),wav=new ArrayBuffer(44+samples.length*2),view=new DataView(wav);
   const str=(o,s)=>[...s].forEach((c,i)=>view.setUint8(o+i,c.charCodeAt(0)));str(0,'RIFF');view.setUint32(4,wav.byteLength-8,true);str(8,'WAVE');str(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,16000,true);view.setUint32(28,32000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,samples.length*2,true);samples.forEach((s,i)=>view.setInt16(44+i*2,Math.max(-1,Math.min(1,s))*32767,true));
   let binary='';const bytes=new Uint8Array(wav);for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
   await transcribe({audio:btoa(binary),target:r.target,model:r.model,language:r.language});
  }catch(e){toast(e.message);}finally{transcribing=false;paint();}
 }
 async function toggle(){
  if(recorder)return finish();if(starting||transcribing)return;starting=true;const id=++attempt,target=captureTarget();paint();let stream,context;
  try{
   const status=await api('/local-engines');if(id!==attempt||!isVisible())return;
   if(!status.models.some(m=>m.id===model&&m.kind==='speech'&&m.installed&&m.available)){await models();return;}
   stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});if(id!==attempt||!isVisible()||target!==captureTarget()){stream.getTracks().forEach(t=>t.stop());return;}
   context=new AudioContext();await context.audioWorklet.addModule('/audio-worklet.js');await context.resume();if(id!==attempt||!isVisible()){stream.getTracks().forEach(t=>t.stop());await context.close();return;}
   const node=new AudioWorkletNode(context,'local-voice-capture'),chunks=[];node.port.onmessage=e=>{if(recorder?.node===node){chunks.push(e.data);let power=0;for(const n of e.data)power+=n*n;recorder.level=Math.sqrt(power/e.data.length);}};
   context.createMediaStreamSource(stream).connect(node);const silent=context.createGain();silent.gain.value=0;node.connect(silent).connect(context.destination);retry=null;
   recorder={stream,context,node,chunks,target,model,language,rate:context.sampleRate,at:Date.now(),level:0,timer:setTimeout(()=>finish(),85000)};tick=setInterval(paint,120);
  }catch(e){stream?.getTracks().forEach(t=>t.stop());await context?.close();toast(e.name==='NotAllowedError'?'Permita o microfone nas configurações do sistema para gravar sua mensagem.':e.message);}finally{starting=false;paint();}
 }
 document.addEventListener('click',e=>{if(e.target.closest('[data-chat-voice]'))toggle();if(e.target.closest('[data-voice-settings]'))models().catch(e=>toast(e.message));if(e.target.closest('[data-voice-discard]')){retry=null;finish(true).then(paint);}if(e.target.closest('[data-voice-retry]')&&retry&&!transcribing)transcribe(retry);});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&recorder){e.preventDefault();finish(true);}});
 return {stop:()=>{attempt++;retry=null;dialog?.close();return finish(true);},paint,busy:()=>Boolean(recorder||starting||transcribing)};
}
