import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Core } from '../src/core.js';
import { createApp } from '../src/server.js';
import { judge, parseWorkflow, TOOLS } from '../src/policy.js';
import { hash, verifyPackage, fingerprint } from '../scripts/protocol.mjs';
import { template } from '../src/model.js';
import { acquireProcessLock } from '../src/lock.js';
import type { Task } from '../src/types.js';

const root = resolve('.');
const password = 'somente-testes-senha-forte';
const input = { title: 'Lançamento da coleção', brief: 'Vídeo de apresentação da coleção de camisas, com tom acolhedor e sem promessas não comprovadas.', requirements: ['Tom acolhedor', 'Não inventar preços'], duration_seconds: 60, workflow_id: 'content', mode: 'template', model: '', budget_minor: 0 };
const completed = '# Coleção\n\n## Ideia\nConheça a coleção.\n\n## Roteiro\nUma nova coleção para acompanhar seu dia. Conheça as peças no catálogo.\n\n## Cenas\nMostrar as peças.\n\n## Requisitos da marca\nTom acolhedor, sem preços.\n\n## Variações\nVenha conhecer as peças.\n\n## Pendências\nNenhuma após conferência humana.\n';

test('Contrato local: integridade, autorização e entrega de ponta a ponta', async t => {
  const dir = mkdtempSync(join(tmpdir(),'colmeia-test-'));
  let core = new Core(dir,root); await core.init(); await core.setup(password);
  const {app} = await createApp(core,'test-token','http://127.0.0.1:4317');
  const headers = {host:'127.0.0.1:4317',authorization:'Bearer test-token'};
  let taskId = '';
  try {
    await t.test('API bloqueia sessão ausente, Host forjado e origem cruzada',async()=>{
      for(const request of [
        {method:'GET' as const,url:'/v1/workspace',headers:{host:headers.host}},
        {method:'GET' as const,url:'/v1/workspace',headers:{...headers,host:'attacker.example'}},
        {method:'POST' as const,url:'/v1/tasks',headers:{...headers,origin:'https://attacker.example'},payload:input}
      ]) { const result = await app.inject(request); assert.ok([401,403].includes(result.statusCode)); }
    });
    await t.test('Esquema fechado recusa organização injetada no corpo',async()=>{
      const result = await app.inject({method:'POST',url:'/v1/tasks',headers:{...headers,'idempotency-key':'test-create-extra'},payload:{...input,organization_id:'other'}});assert.equal(result.statusCode,400);
    });
    await t.test('Criação idempotente não duplica entrega nem evento',async()=>{
      const a = await core.create(input,'test-create-001'), b = await core.create(input,'test-create-001'); taskId=a.id;
      assert.equal(a.id,b.id);assert.equal((await core.snapshot()).tasks.length,1);
      await assert.rejects(core.create({...input,title:'Outro título'},'test-create-001'),/outro conteúdo/);
    });
    await t.test('Conteúdo hostil não concede shell, rede ou ferramenta nova',async()=>{
      const source=readFileSync(join(root,'workflows/content-v1.yaml'),'utf8');
      assert.throws(()=>parseWorkflow(source.replace('content.compose','shell.exec'),TOOLS));
      assert.throws(()=>parseWorkflow(source.replace('version: 1','version: 2').replace('  - tool: content.compose','  - tool: files.commit_version'),TOOLS));
      assert.throws(()=>parseWorkflow(source.replace('  - human_review\n',''),TOOLS));
      const task=(await core.snapshot()).tasks[0],agent=(await core.snapshot()).identities.find(i=>i.kind==='agent')!,human=(await core.snapshot()).identities.find(i=>i.kind==='human')!;
      assert.throws(()=>judge(task.action,null,agent,human,TOOLS,task.workflow,'wrong'),/Cossinatura/);
      assert.throws(()=>judge({...task.action,tool:'shell.exec'},null,agent,human,TOOLS,task.workflow,'wrong'));
    });
    await t.test('Execução gera estrutura identificada e exige revisão humana',async()=>{
      await core.start(taskId,'test-start-001');await core.wait(taskId);
      const task=(await core.snapshot()).tasks[0]; assert.equal(task.state,'review');assert.equal(task.versions.length,1);
      assert.match(task.versions[0].body,/sem geração por IA/);
      assert.equal(task.checks.find(c=>c.name==='human_review')?.pass,false);
      await assert.rejects(core.review(taskId,task.versions[0].hash,['requirements','duration','human_review'],'review-raw-001'),/Preencha/);
      await core.start(taskId,'test-start-001');await core.wait(taskId);assert.equal((await core.snapshot()).tasks[0].versions.length,1);
      const entries=await core.store.entries();assert.ok(entries.some(e=>e.type==='spend.reserved'));assert.ok(entries.some(e=>e.type==='spend.settled'));
      assert.ok(entries.filter(e=>e.author_id==='agent').every(e=>e.authorization&&e.action_hash));
    });
    await t.test('Nova versão de fluxo não altera contratos anteriores',async()=>{
      const source=readFileSync(join(root,'workflows/content-v1.yaml'),'utf8').replace('version: 1','version: 2');
      await core.registerWorkflow(source);assert.equal((await core.snapshot()).tasks[0].workflow.version,1);
      await assert.rejects(core.registerWorkflow(source),/imutável/);
    });
    await t.test('Edição concorrente não sobrescreve e restauração cria versão',async()=>{
      const original=(await core.snapshot()).tasks[0].versions[0];
      await core.edit(taskId,completed,original.hash,'test-edit-001');
      await assert.rejects(core.edit(taskId,'Sobrescrita',original.hash,'test-edit-002'),/Conflito/);
      const current=(await core.snapshot()).tasks[0].versions.at(-1)!;
      await core.restore(taskId,original.id,current.hash,'test-restore-001');
      let task=(await core.snapshot()).tasks[0];assert.equal(task.versions.length,3);assert.equal(task.versions.at(-1)!.body,original.body);
      await core.edit(taskId,completed,task.versions.at(-1)!.hash,'test-edit-003');
      task=(await core.snapshot()).tasks[0];
      await assert.rejects(core.review(taskId,task.versions.at(-1)!.hash,['duration'],'test-review-001'),/todas/);
      await core.review(taskId,task.versions.at(-1)!.hash,['requirements','duration','human_review'],'test-review-002');
      assert.equal((await core.snapshot()).tasks[0].state,'validated');
    });
    await t.test('Pacote externo verifica e não contém briefing nem chaves privadas',async()=>{
      const bundle=await core.export(),trust=fingerprint(bundle.root_public_key);assert.equal(verifyPackage(bundle,trust).valid,true);
      assert.ok(!JSON.stringify(bundle).includes(input.brief));assert.ok(!JSON.stringify(bundle).includes('PRIVATE KEY'));
      const file=join(dir,'export.json');writeFileSync(file,JSON.stringify(bundle));
      const cli=spawnSync(process.execPath,[join(root,'scripts/verify.mjs'),file,trust],{encoding:'utf8',cwd:tmpdir()});assert.equal(cli.status,0,cli.stderr);
    });
    await t.test('Verificador detecta alteração, remoção, ordem, truncamento e raiz falsa',async()=>{
      const bundle=await core.export(),trust=fingerprint(bundle.root_public_key);
      const altered=structuredClone(bundle);altered.entries[1].payload_hash='a'.repeat(64);assert.equal(verifyPackage(altered,trust).valid,false);
      const missing=structuredClone(bundle);missing.entries.splice(2,1);assert.equal(verifyPackage(missing,trust).valid,false);
      const reordered=structuredClone(bundle);[reordered.entries[1],reordered.entries[2]]=[reordered.entries[2],reordered.entries[1]];assert.equal(verifyPackage(reordered,trust).valid,false);
      const truncated=structuredClone(bundle);truncated.entries.pop();assert.equal(verifyPackage(truncated,trust).valid,false);
      const empty=structuredClone(bundle);empty.entries=[];assert.equal(verifyPackage(empty,trust).valid,false);
      assert.equal(verifyPackage(bundle,'0'.repeat(64)).valid,false);assert.equal(verifyPackage({},trust).valid,false);
    });
    await t.test('Assinatura humana adulterada é rejeitada',async()=>{
      const bundle=await core.export(),trust=fingerprint(bundle.root_public_key),agentEntry=bundle.entries.find(e=>e.author_id==='agent')!;
      agentEntry.authorization!.signature='AAAA';assert.equal(verifyPackage(bundle,trust).valid,false);
    });
    await t.test('Log recusa UPDATE e DELETE na camada SQL',async()=>{
      await assert.rejects(core.store.db.exec('DELETE FROM event_log WHERE seq = 1'),/append-only/);
      await assert.rejects(core.store.db.exec("UPDATE event_log SET entry_hash = 'broken' WHERE seq = 1"),/append-only/);
    });
    await t.test('Cofre bloqueado, senha incorreta e reinício preservam entrega',async()=>{
      core.vault.lock();await assert.rejects(core.snapshot(),/bloqueado/);await assert.rejects(core.unlock('senha-errada'),/incorreta/);
      await core.unlock(password);assert.equal((await core.snapshot()).tasks[0].state,'validated');
      await app.close();await core.close();core=new Core(dir,root);await core.init();await core.unlock(password);
      assert.equal((await core.snapshot()).tasks[0].versions.length,4);assert.equal(verifyPackage(await core.export(),(await core.snapshot()).root_fingerprint).valid,true);
    });
    await t.test('Estado persistido adulterado não é revalidado pelo serviço',async()=>{
      const original=await core.store.read();const altered=structuredClone(original)!;altered.agent.cap_minor=999;
      await core.store.db.query('UPDATE workspace_state SET document=$1 WHERE id=1',[JSON.stringify(altered)]);
      await assert.rejects(core.snapshot(),/Integridade/);await assert.rejects(core.export(),/Integridade/);
      await core.store.db.query('UPDATE workspace_state SET document=$1 WHERE id=1',[JSON.stringify(original)]);
    });
  } finally {await app.close();await core.close();rmSync(dir,{recursive:true,force:true});}
});

test('Revogação durante inferência impede confirmação e mantém recuperação',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'colmeia-revoke-'));let release!: (value:string)=>void;
  const core=new Core(dir,root,async()=>new Promise<string>(resolve=>{release=resolve;}));
  try{
    await core.init();await core.setup(password);const {id}=await core.create(input,'revocation-create');await core.start(id,'revocation-start');
    while(!release)await new Promise(resolve=>setImmediate(resolve));await core.revokeAgent();release(completed);await core.wait(id);
    const task=(await core.snapshot()).tasks[0];assert.equal(task.state,'paused');assert.equal(task.versions.length,0);
    await assert.rejects(core.start(id,'revocation-restart'),/revogado/);
    assert.equal(verifyPackage(await core.export(),(await core.snapshot()).root_fingerprint).valid,true);
  }finally{await core.close();rmSync(dir,{recursive:true,force:true});}
});

test('Reservas concorrentes e liquidação idempotente preservam teto rígido',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'colmeia-budget-'));let release!: (value:string)=>void;
  const core=new Core(dir,root,async()=>new Promise<string>(resolve=>{release=resolve;}));
  try{
    await core.init();await core.setup(password);
    // Trusted test fixture only. Production exposes no API for an agent to alter limits.
    await core.store.tx(state=>{state!.agent.cap_minor=100;state!.workflows[0].budget_minor=100;});
    const {id}=await core.create({...input,budget_minor:100},'budget-create-001');await core.start(id,'budget-start-001');
    while(!release)await new Promise(resolve=>setImmediate(resolve));
    const results=await Promise.allSettled([core.reserve(id,70,'reserve-race-001'),core.reserve(id,70,'reserve-race-002')]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await core.snapshot()).tasks[0].reserved_minor,70);
    const success=results.find(r=>r.status==='fulfilled') as PromiseFulfilledResult<{id:string}>;
    await assert.rejects(core.settle(success.value.id,71),/excede/);await core.settle(success.value.id,50);await core.settle(success.value.id,50);
    assert.equal((await core.snapshot()).tasks[0].spent_minor,50);assert.equal((await core.snapshot()).tasks[0].reserved_minor,0);
    await assert.rejects(core.reserve(id,51,'reserve-over-001'),/insuficiente/);await assert.rejects(core.reserve(id,-1,'reserve-negative'),/inválido/);
    release(completed);await core.wait(id);
  }finally{await core.close();rmSync(dir,{recursive:true,force:true});}
});

test('Pausa, falha e reinício exigem nova autorização sem repetir versão',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'colmeia-recovery-'));let release!: (value:string)=>void;
  const core=new Core(dir,root,async()=>new Promise<string>(resolve=>{release=resolve;}));
  try{
    await core.init();await core.setup(password);const {id}=await core.create(input,'pause-create-001');await core.start(id,'pause-start-001');
    while(!release)await new Promise(resolve=>setImmediate(resolve));await core.pause(id);release(completed);await core.wait(id);
    assert.equal((await core.snapshot()).tasks[0].versions.length,0);
    core.composer=async()=>{throw new Error('Falha de conexão simulada');};await core.start(id,'failure-start-001');await core.wait(id);
    assert.equal((await core.snapshot()).tasks[0].state,'paused');
    core.composer=async(task:Task)=>template(task);await core.start(id,'recovery-start-001');await core.wait(id);
    assert.equal((await core.snapshot()).tasks[0].versions.length,1);
  }finally{await core.close();rmSync(dir,{recursive:true,force:true});}
});

test('Reabertura de estado interrompido pausa e libera reserva local',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'colmeia-interrupted-'));let core=new Core(dir,root);
  try{
    await core.init();await core.setup(password);const {id}=await core.create(input,'interrupted-create');
    await core.store.tx((state,entries)=>{const task=state!.tasks[0];task.state='running';task.generation=1;core.approveSteps(state!,entries,task);state!.reservations.push({id:'interrupted-call',task_id:id,amount:0,actual:null,state:'reserved'});});
    await core.close();core=new Core(dir,root);await core.init();await core.unlock(password);
    const snapshot=await core.snapshot();assert.equal(snapshot.tasks[0].state,'paused');assert.deepEqual(snapshot.tasks[0].grants,{});assert.equal(snapshot.reservations[0].state,'released');
    assert.ok((await core.store.entries()).some(entry=>entry.type==='task.recovered'));
  }finally{await core.close();rmSync(dir,{recursive:true,force:true});}
});

test('Mesmo diretório não admite dois processos de serviço',()=>{
  const dir=mkdtempSync(join(tmpdir(),'colmeia-lock-'));const release=acquireProcessLock(dir);
  try{assert.throws(()=>acquireProcessLock(dir),/outro processo/);release();const second=acquireProcessLock(dir);second();}finally{release();rmSync(dir,{recursive:true,force:true});}
});
