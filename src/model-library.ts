import {CatalogAccess} from './catalog-access.js';
import {hfHeaders,hfError} from './hf-access.js';
import { prepareHF, validSavedModel } from './huggingface.js';
import { MEDIA_CATALOG } from './media-catalog.js';
import { LocalRuntime } from './runtime.js';
import { homedir, totalmem } from 'node:os';
import { join, delimiter } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, rmSync, statfsSync, createReadStream, statSync } from 'node:fs';
import { open } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { CATALOG, catalogModel, catalogFiles, modelUrl, type CatalogModel } from './catalog.js';
import { localModels, memoryStatus } from './model.js';

const exec = promisify(execFile);
const GiB = 1024 ** 3;
const modelFolder = (directory: string, model: CatalogModel) => model.parts ? join(directory, 'catalog-' + model.id) : directory;
const modelPath = (directory: string, model: CatalogModel) => join(modelFolder(directory,model),model.file);
const endpoint = 'http://127.0.0.1:8080';
type Job = { id: string; state: 'downloading' | 'verifying' | 'downloaded' | 'importing' | 'indexing' | 'installed' | 'cancelled' | 'failed'; downloaded: number; total: number; error?: string; model_key?: string };
type LocalModel = { type: string; key: string; display_name?: string; size_bytes?: number; format?: string; quantization?: { name: string }; loaded_instances?: { id: string; config?: { context_length?: number } }[] };
type Audit = (type: string, data: unknown) => Promise<void>;

export function findLms(platform = process.platform, home = homedir(), path = process.env.PATH ?? '') {
  const name = platform === 'win32' ? 'lms.exe' : 'lms';
  return [join(home, '.lmstudio', 'bin', name), ...path.split(delimiter).filter(Boolean).map(dir => join(dir, name))].find(existsSync) ?? null;
}
function safeDownloadUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !(url.hostname === 'huggingface.co' || url.hostname.endsWith('.huggingface.co') || url.hostname.endsWith('.hf.co'))) throw new Error('Destino de download não autorizado');
  return url;
}
export async function downloadVerified(model: CatalogModel, destination: string, signal: AbortSignal, progress: (bytes: number) => void, fetcher = fetch, options:{token?:string;resume?:boolean}={}) {
  signal.throwIfAborted();let url=safeDownloadUrl(modelUrl(model)),offset=0,hash=createHash('sha256');
  if(options.resume&&existsSync(destination)){
    offset=statSync(destination).size;
    if(offset>model.bytes){rmSync(destination);offset=0;}
    else for await(const chunk of createReadStream(destination)){signal.throwIfAborted();hash.update(chunk);}
    if(offset===model.bytes){if(hash.digest('hex')===model.sha256){progress(offset);return;}rmSync(destination);offset=0;hash=createHash('sha256');}
  }
  progress(offset);let response:Response|undefined;
  for(let redirects=0;redirects<=5;redirects++){
    response=await fetcher(url,{redirect:'manual',signal,headers:{...hfHeaders(url,options.token),...(offset?{Range:`bytes=${offset}-`}:{})}});
    if([301,302,303,307,308].includes(response.status)){const location=response.headers.get('location');await response.body?.cancel();if(!location)throw Error('Redirecionamento sem destino');url=safeDownloadUrl(new URL(location,url).href);response=undefined;continue;}break;
  }
  if(!response?.ok||!response.body)throw Error(response?hfError(response.status):'Download indisponível.');
  if(response.status===206){const range=/^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get('content-range')||'');if(!range||Number(range[1])!==offset||Number(range[2])!==model.bytes-1||Number(range[3])!==model.bytes){await response.body.cancel();throw Error('Intervalo de retomada inválido.');}}
  else if(offset){offset=0;hash=createHash('sha256');}
  const length=response.headers.get('content-length');if(length&&Number(length)!==model.bytes-offset){await response.body.cancel();throw Error('Tamanho publicado mudou; download recusado');}
  const output=await open(destination,options.resume?(offset?'a':'w'):'wx',0o600);let size=offset;
  try{for await(const chunk of response.body as any as AsyncIterable<Uint8Array>){signal.throwIfAborted();size+=chunk.byteLength;if(size>model.bytes)throw Error('Download excedeu o tamanho aprovado');hash.update(chunk);let written=0;while(written<chunk.length)written+=(await output.write(chunk.subarray(written))).bytesWritten;progress(size);}
    if(size!==model.bytes)throw Error('Arquivo incompleto; continue o download para retomar.');
    if(hash.digest('hex')!==model.sha256){await output.close();rmSync(destination,{force:true});throw Error('SHA-256 divergente; arquivo recusado.');}await output.sync();
  }finally{await output.close();}
}
export async function downloadParts(model: CatalogModel, directory: string, signal: AbortSignal, progress: (bytes: number) => void, fetcher = fetch, options:{token?:string;resume?:boolean}={}) {
  let completed=0;for(const part of catalogFiles(model)){signal.throwIfAborted();await downloadVerified({...model,...part},join(directory,part.file),signal,bytes=>progress(completed+bytes),fetcher,options);completed+=part.bytes;}
}
async function fileHash(path: string) { const hash = createHash('sha256'); for await (const chunk of createReadStream(path)) hash.update(chunk); return hash.digest('hex'); }
export function admitMemory(bytes: number, available: number, pressure: number | null) {
  if (available < bytes + GiB || (pressure !== null && pressure < 5)) throw new Error('Memória disponível insuficiente. Feche outros aplicativos, libere um modelo ou escolha uma opção menor.');
}
export class ModelLibrary {
  readonly directory: string;
  readonly access: CatalogAccess;
  readonly catalog:CatalogModel[]=[...CATALOG];
  model(id:string){const m=this.catalog.find(m=>m.id===id);if(!m)throw new Error("Modelo fora do catálogo aprovado");return m;}
  async addHF(repo:string,variant?:string){const model=await prepareHF(repo,variant,this.hfToken());if(!this.catalog.some(m=>m.id===model.id)){this.catalog.push(model);this.saveCatalog();}return model;}
  saveCatalog(){const path=join(this.directory,"hub-catalog.json");writeFileSync(path+".tmp",JSON.stringify(this.catalog.filter(m=>m.id.startsWith("hub-"))),{mode:0o600});renameSync(path+".tmp",path);}
  jobs: Record<string, Job> = {};
  active: { controller: AbortController; promise: Promise<void> } | null = null;
  busy = false;
  constructor(directory: string, private audit: Audit, private lms = findLms(), private runtime?: LocalRuntime, private hfToken:()=>string|undefined=()=>undefined) {
    this.directory = join(directory, 'models'); mkdirSync(this.directory, { recursive: true, mode: 0o700 });this.access=new CatalogAccess(this.directory,hfToken);
    try{const saved=JSON.parse(readFileSync(join(this.directory,'hub-catalog.json'),'utf8'));if(Array.isArray(saved))for(const m of saved.slice(0,2000)){if(validSavedModel(m)&&!this.catalog.some(c=>c.id===m.id))this.catalog.push(m);}}catch{}
    try { this.jobs = JSON.parse(readFileSync(join(this.directory, 'downloads.json'), 'utf8')); } catch { /* First use. */ }
    this.runtime?.setCatalog(this.catalog);
    for (const [id, job] of Object.entries(this.jobs)) {
      if (!this.catalog.some(model => model.id === id)) { delete this.jobs[id]; continue; }
      if (['downloading','verifying','importing'].includes(job.state)) { job.state = 'failed'; job.error = 'Interrompido ao fechar. Continue o download para retomar os arquivos já recebidos.'; }
    }
  }
  save() { const path = join(this.directory, 'downloads.json'); writeFileSync(path + '.tmp', JSON.stringify(this.jobs), { mode: 0o600 }); renameSync(path + '.tmp', path); }
  async cli(args: string[]) {
    if (!this.lms) throw new Error('Instale e abra o LM Studio. Depois ative a ferramenta lms nas configurações do LM Studio.');
    const pending = exec(this.lms, args, { timeout: 120000, maxBuffer: 1024 * 1024, windowsHide: true, shell: false });
    // Some lms versions ask an introductory question even with --yes.
    // This fixed answer only applies to the user's explicit, catalog-scoped import.
    pending.child.stdin?.end(args[0] === 'import' ? 'y\n' : undefined);
    try { return await pending; } catch (error) {
      const failure = error as { killed?: boolean };
      throw new Error(failure.killed ? 'O LM Studio demorou para responder. Abra o motor e tente novamente.' : 'Não foi possível concluir no LM Studio. Confira se o motor está aberto e se há espaço na pasta de modelos.');
    }
  }
  async native(path = '', body?: unknown, timeout = 5000) {
    const response = await fetch(endpoint + '/api/v1/models' + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(timeout), redirect: 'error' });
    if (!response.ok) throw new Error(`LM Studio retornou HTTP ${response.status}. Confira o servidor local e a autenticação no LM Studio.`);
    return response.json() as Promise<any>;
  }
  async inventory(): Promise<LocalModel[]> { const result = await this.native(); if (!Array.isArray(result.models)) throw new Error('API nativa do LM Studio indisponível'); return result.models.filter((m: LocalModel) => m.type === 'llm'); }
  async snapshot() {
    await this.runtime?.exo.refresh();
    const status = await localModels();
    const nativeInstalled=this.runtime?this.runtime.inventory():[];
    const external=status.api === 'lmstudio' ? await this.inventory().catch(() => []) : [];
    const installed=[...nativeInstalled,...external];
    const disk = statfsSync(this.directory);
    return { ...status, access_summary:this.access.summary(this.catalog),media_catalog:MEDIA_CATALOG, available:status.available||Boolean(this.runtime?.available)||Boolean(this.runtime?.exo.connected), integrated_available:Boolean(this.runtime?.available), mlx_available:Boolean(this.runtime?.mlxAvailable), integrated_loaded:this.runtime?.status().models||[], total_memory_bytes: totalmem(), platform: process.platform, architecture: process.arch, lms_available: Boolean(this.lms), busy: this.busy, disk_free_bytes: disk.bavail * disk.bsize, catalog: this.catalog.map(model => ({ ...model, availability:this.access.get(model),format: 'GGUF', context: 4096, tokenizer: 'Incluído no GGUF', source: `https://huggingface.co/${model.repo}/tree/${model.revision}`, job: this.jobs[model.id] ?? null, local_key: nativeInstalled.find(entry=>model.id.startsWith('hub-')?entry.path===modelPath(this.directory,model):(entry.path.endsWith('/'+model.file)||entry.path.endsWith('\\'+model.file)))?.key ?? installed.find(entry => entry.key === (this.jobs[model.id]?.model_key ?? `${model.id}-${model.revision.slice(0,12)}`))?.key ?? null, downloaded_file: existsSync(modelPath(this.directory,model)), fits_now: status.available_memory_bytes >= (model.ram_gib + 1) * GiB })), installed };
  }
  async startEngine() {
    if(this.runtime?.available)return {ok:true,engine:'integrated'};
    if (this.busy) throw new Error('Aguarde a operação atual'); this.busy = true;
    try {
      const status = await localModels();
      if (status.available) { if (status.api !== 'lmstudio') throw new Error('A porta 8080 já está ocupada por outro motor. Mantenha esse motor ou configure o LM Studio na porta 8080.'); return { ok: true }; }
      await this.audit('model.engine.start_requested', { bind: '127.0.0.1', port: 8080 });
      await this.cli(['server','start','--port','8080','--bind','127.0.0.1']);
      if ((await localModels()).api !== 'lmstudio') throw new Error('Abra o LM Studio e tente conectar novamente.');
      await this.audit('model.engine.started', { endpoint }); return { ok: true };
    } finally { this.busy = false; }
  }
  async download(id: string) {
    const model = this.model(id);
    if (this.jobs[id]?.state === 'downloaded' && existsSync(modelPath(this.directory,model))) return this.jobs[id];
    if(model.parts && existsSync(modelFolder(this.directory,model))) throw new Error('Este conjunto já está no disco. Instale-o ou remova a pasta incompleta antes de baixar novamente.');
    if (this.active) { if (this.jobs[id]?.state === 'downloading') return this.jobs[id]; throw new Error('Aguarde ou cancele o download atual'); }
    if (this.jobs[id]?.state === 'installed') {
      const existing = [...(this.runtime?.inventory()||[]),...await this.inventory().catch(() => [])];
      if (existing.some(model => model.key === this.jobs[id].model_key)) return this.jobs[id];
    }
    const targetPath=model.parts?modelFolder(this.directory,model):modelPath(this.directory,model);
    const partialPath=targetPath+'.part';
    const retained=model.parts?catalogFiles(model).reduce((n,p)=>{const f=join(partialPath,p.file);return n+(existsSync(f)?Math.min(p.bytes,statSync(f).size):0);},0):(existsSync(partialPath)?Math.min(model.bytes,statSync(partialPath).size):0);
    const disk = statfsSync(this.directory);
    if (disk.bavail * disk.bsize < model.bytes-retained + GiB) throw new Error('Espaço em disco insuficiente para baixar este modelo com margem de 1 GiB');
    // Reserve synchronously before yielding, so simultaneous requests cannot start two downloads.
    const controller = new AbortController();
    const active = { controller, promise: Promise.resolve() }; this.active = active;
    try { await this.audit('model.download.requested', { id, revision: model.revision, sha256: model.sha256, bytes: model.bytes, source: modelUrl(model,catalogFiles(model)[0]), parts:catalogFiles(model) }); }
    catch (error) { this.active = null; throw error; }
    const job: Job = this.jobs[id] = { id, state: 'downloading', downloaded: 0, total: model.bytes }; this.save();
    const target = model.parts ? modelFolder(this.directory,model) : modelPath(this.directory,model);
    const partial = target + '.part';
    active.promise = (async () => {
      try {
        const signal=controller.signal;
        const checked=await this.access.check(model,signal);if(!['public','authorized'].includes(checked.access))throw Error(checked.error||'Acesso ao modelo não confirmado.');
        if(model.parts)mkdirSync(partial,{mode:0o700,recursive:true});
        if(model.parts)await downloadParts(model,partial,signal,bytes=>{job.downloaded=bytes;},fetch,{resume:true,token:this.hfToken()});
        else await downloadVerified(model,partial,signal,bytes=>{job.downloaded=bytes;},fetch,{resume:true,token:this.hfToken()});
        job.state = 'verifying'; this.save();
        renameSync(partial, target); job.state = 'downloaded'; this.save();
        await this.audit('model.download.verified', { id, revision: model.revision, sha256: model.sha256, bytes: model.bytes });
      } catch (error) {
        job.state = controller.signal.aborted ? 'cancelled' : 'failed';
        job.error = controller.signal.aborted ? 'Download pausado. Os arquivos recebidos foram preservados; clique em Continuar download.' : (error as Error).message;
        this.save(); await this.audit('model.download.' + job.state, { id, error: job.error });
      } finally { if (this.active === active) this.active = null; }
    })();
    // Persisted errors are exposed in snapshot; never leak an unhandled rejection on shutdown.
    active.promise.catch(() => {});
    return job;
  }
  async cancel(id: string) {
    this.model(id);
    if (this.active && this.jobs[id]?.state === 'downloading') { this.active.controller.abort(); await this.active?.promise; }
    return { ok: true };
  }
  async install(id: string) {
    const model = this.model(id);
    if (this.busy) throw new Error('Aguarde a operação atual'); this.busy = true;
    try {
      const job = this.jobs[id];
      if (job?.state === 'installed') return job;
      const target = modelPath(this.directory,model);
      if (!job) throw new Error('Baixe o modelo primeiro');
      const repo = `colmeia/${id}-${model.revision.slice(0,12)}`;
      if (existsSync(target)) {
        for(const part of catalogFiles(model)){const path=join(modelFolder(this.directory,model),part.file);if(!existsSync(path)||await fileHash(path)!==part.sha256)throw new Error('Arquivo alterado ou parte ausente; baixe novamente antes de instalar');}
        if(model.parts&&!this.runtime?.available)throw new Error('Modelos em partes precisam do motor integrado neste aplicativo.');
        if(this.runtime?.available){job.state='installed';job.model_key=this.runtime.inventory().find(entry=>entry.path===target)?.key;this.save();await this.audit('model.import.completed',{id,model_key:job.model_key??null,engine:'integrated',sha256:model.sha256});return job;}
        await this.audit('model.import.requested', { id, sha256: model.sha256 });
        job.state = 'importing'; this.save();
        // Only fixed catalog values, never shell text or user-provided paths.
        await this.cli(['import', target, '--user-repo', repo, '--yes']);
        job.state = 'indexing'; this.save();
      } else if (job.downloaded !== model.bytes) throw new Error('Baixe o modelo primeiro');
      let imported: any;
      for (let attempt = 0; attempt < 10; attempt++) {
        const { stdout } = await this.cli(['ls','--json']);
        imported = JSON.parse(stdout).find((entry: any) => entry.path === `${repo}/${model.file}` && entry.sizeBytes === model.bytes);
        if (imported) break;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      if (!imported) throw new Error('O LM Studio ainda não indexou o arquivo. Tente adicionar à biblioteca novamente.');
      job.model_key = imported.modelKey; job.state = 'installed'; delete job.error; this.save();
      await this.audit('model.import.completed', { id, model_key: job.model_key, sha256: model.sha256 }); return job;
    } catch (error) { const job = this.jobs[id]; if (job) { job.state = 'failed'; job.error = (error as Error).message; this.save(); } throw error; }
    finally { this.busy = false; }
  }
  async load(key: string, context = 16384) {
    if(this.runtime?.owns(key)){if(this.busy)throw new Error('Aguarde a operação atual');this.busy=true;try{return await this.runtime.load(key,context);}finally{this.busy=false;}}
    if (this.busy) throw new Error('Aguarde a operação atual'); this.busy = true;
    try {
      const installed = (await this.inventory()).find(model => model.key === key);
      if (!installed) throw new Error('Modelo não encontrado neste computador');
      if (installed.loaded_instances?.length) return { instance_id: installed.loaded_instances[0].id, status: 'loaded', load_config: installed.loaded_instances[0].config };
      if (!installed.size_bytes) throw new Error('O motor não informou o tamanho do modelo. Carregue-o manualmente no LM Studio.');
      const catalog = this.catalog.find(model => this.jobs[model.id]?.model_key === key);
      const estimate = (catalog ? catalog.ram_gib * GiB : Math.ceil(installed.size_bytes * 1.35 + GiB)) + Math.max(0,context-4096)*64*1024;
      const memory = memoryStatus(); admitMemory(estimate, memory.available_memory_bytes, memory.pressure_free_percent);
      await this.audit('model.load.requested', { key, context, estimate_bytes: estimate, available_bytes: memory.available_memory_bytes, catalog_id: catalog?.id ?? null });
      const result = await this.native('/load', { model: key, context_length: context, flash_attention: true, echo_load_config: true }, 120000);
      // Some engine versions auto-fit context upward despite an explicit request.
      // Report the effective setting and recheck pressure instead of claiming a 4k cap.
      const after = memoryStatus();
      try { admitMemory(0, after.available_memory_bytes, after.pressure_free_percent); }
      catch {
        await this.native('/unload', { instance_id: result.instance_id }, 30000);
        await this.audit('model.load.rejected', { key, reason: 'memory_after_load', available_bytes: after.available_memory_bytes });
        throw new Error('O motor consumiu a margem de memória. O modelo foi descarregado; escolha uma opção menor.');
      }
      const effective = result.load_config?.context_length;
      if (!Number.isFinite(effective) || effective > context) result.warning = 'O motor ajustou o contexto automaticamente. Confira a configuração efetiva na biblioteca; o consumo pode superar a estimativa de RAM.';
      await this.audit('model.load.completed', { key, instance_id: result.instance_id, load_config: result.load_config ?? null }); return result;
    } finally { this.busy = false; }
  }
  async unload(instance: string) {
    if(this.runtime?.owns(instance))return this.runtime.unload(instance);
    if (this.busy) throw new Error('Aguarde a operação atual'); this.busy = true;
    try {
      if (!(await this.inventory()).some(model => model.loaded_instances?.some(loaded => loaded.id === instance))) throw new Error('Modelo carregado não encontrado');
      await this.audit('model.unload.requested', { instance });
      await this.native('/unload', { instance_id: instance }, 30000);
      await this.audit('model.unload.completed', { instance }); return { ok: true };
    } finally { this.busy = false; }
  }
  async stop() {
    if (this.busy) throw new Error('Aguarde o carregamento ou a instalação terminar antes de bloquear ou fechar o espaço.');
    const active = this.active; active?.controller.abort(); if (active) await active.promise;await this.runtime?.close();
  }
}
