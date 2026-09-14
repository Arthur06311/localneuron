import { randomUUID, createPublicKey } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { Store } from './store.js';
import { Vault } from './vault.js';
import { TOOLS, parseWorkflow, judge } from './policy.js';
import { compose, validate } from './model.js';
import { hash, signature, validSignature, fingerprint, verifyPackage } from '../scripts/protocol.mjs';
import type { Action, Entry, Grant, Identity, State, Task } from './types.js';

const taskInput = z.strictObject({ title: z.string().trim().min(3).max(140), brief: z.string().trim().min(10).max(16000), requirements: z.array(z.string().trim().min(1).max(500)).min(1).max(40), duration_seconds: z.number().int().min(10).max(3600), workflow_id: z.string(), mode: z.enum(['template','model']), model: z.string().max(200).default(''), budget_minor: z.number().int().nonnegative().max(1000000).default(0) });
const requireState = (state: State | null): State => { if (!state) throw new Error('Configure o espaço de trabalho'); return state; };
const findTask = (state: State, id: string) => { const task = state.tasks.find(t => t.id === id); if (!task) throw new Error('Entrega não encontrada'); return task; };

export class Core {
  store: Store;
  vault: Vault;
  jobs = new Map<string, { controller: AbortController; promise: Promise<void> }>();
  constructor(public directory: string, public root: string, public composer = compose) {
    this.store = new Store(join(directory, 'postgres')); this.vault = new Vault(directory);
    const sealBody = (state: State, entries: Entry[]) => { const { seal, ...document } = state; return { state_hash: hash(document), log_hash: hash(entries) }; };
    this.store.assertIntegrity = (state, entries) => {
      if (this.vault.locked) return;
      if (!state.seal || !validSignature(sealBody(state, entries), state.seal, createPublicKey(this.vault.key('organization')))) throw new Error('Integridade do armazenamento divergente. Restaure um backup confiável.');
    };
    this.store.sealState = (state, entries) => { state.seal = signature(sealBody(state, entries), this.vault.key('organization')); };
  }
  async init() { await this.store.init(); }
  actor(state: State, kind: Identity['kind']) { const actor = state.identities.find(i => i.kind === kind); if (!actor) throw new Error('Identidade ausente'); return actor; }
  append(state: State, entries: Entry[], type: string, payload: unknown, authorId = 'human', taskId = '', action: Action | null = null, grant: Grant | null = null) {
    const actor = state.identities.find(i => i.id === authorId);
    if (!actor || actor.revoked_seq !== null) throw new Error('Autor revogado ou desconhecido');
    const previous = entries.at(-1);
    const body = { seq: entries.length + 1, log_id: state.log_id, prev_hash: previous?.entry_hash ?? '0'.repeat(64), at: Math.max(Date.now(), previous?.at ?? 0), type, author_id: authorId, payload_hash: hash(payload), payload_ref: taskId ? `task:${taskId}` : `workspace:${state.log_id}`, action_hash: action ? hash(action) : null, authorization: grant };
    if (actor.kind === 'agent' && (!grant || !action)) throw new Error('Agente exige autorização');
    entries.push({ ...body, entry_hash: hash(body), author_signature: signature(body, this.vault.key(authorId)) });
  }
  async setup(password: string) {
    if (await this.store.read()) throw new Error('Espaço já configurado');
    // Recover an interrupted first setup with the same encrypted vault.
    const publics = this.vault.exists ? (this.vault.unlock(password), Object.fromEntries(Object.entries(this.vault.keys!).map(([id, key]) => [id, createPublicKey(key).export({ type: 'spki', format: 'pem' }).toString()]))) : this.vault.initialize(password);
    const identities: Identity[] = ['human','agent','service'].map(id => ({ id, name: id === 'human' ? 'Responsável local' : id === 'agent' ? 'Editor de conteúdo' : 'Validação e orçamento', kind: id as Identity['kind'], public_key: publics[id], owner_id: id === 'agent' ? 'human' : null, revoked_seq: null, epoch: 0 }));
    const workflow = parseWorkflow(readFileSync(join(this.root, 'workflows/content-v1.yaml'), 'utf8'), TOOLS);
    const state: State = { log_id: randomUUID(), identities, agent: { id: 'agent', scope: [...TOOLS], cap_minor: 0, epoch: 0 }, workflows: [workflow], tasks: [], reservations: [], idempotency: {} };
    await this.store.bootstrap(state);
    await this.store.tx((s, entries) => this.append(requireState(s), entries, 'workspace.created', { log_id: state.log_id, identities }));
  }
  async unlock(password: string) {
    this.vault.unlock(password);
    await this.store.tx((s, entries) => {
      const state = requireState(s);
      for (const task of state.tasks.filter(t => t.state === 'running')) { task.state = 'paused'; task.generation++; task.grants = {}; task.error = 'Execução interrompida. Revise e autorize uma nova tentativa.'; this.releaseLocalReservations(state, entries, task); this.append(state, entries, 'task.recovered', { id: task.id, state: task.state }, 'service', task.id); }
    });
  }
  async status() { const initialized=Boolean(await this.store.read()), vault_exists=this.vault.exists; return { initialized, locked: this.vault.locked, vault_exists, access_state: initialized ? "existing" : vault_exists ? "recovery" : "new" }; }
  async snapshot() { if (this.vault.locked) throw new Error('Cofre bloqueado'); const s = requireState(await this.store.read()); return { ...s, idempotency: undefined, root_fingerprint: fingerprint(createPublicKey(this.vault.key('organization')).export({ type: 'spki', format: 'pem' }).toString()) }; }
  async idempotent<T>(key: string, input: unknown, operation: (state: State, entries: Entry[]) => T): Promise<T> {
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(key)) throw new Error('Idempotency-Key inválida');
    return this.store.tx((s, entries) => {
      const state = requireState(s); const digest = hash(input); const existing = state.idempotency[key];
      if (existing) { if (existing.hash !== digest) throw new Error('Idempotency-Key reutilizada com outro conteúdo'); return existing.result as T; }
      const result = operation(state, entries); state.idempotency[key] = { hash: digest, result }; return result;
    });
  }
  async create(input: unknown, key: string) {
    const data = taskInput.parse(input);
    return this.idempotent(key, { operation: 'create', data }, (state, entries) => {
      const workflow = state.workflows.filter(w => w.id === data.workflow_id).sort((a,b) => b.version - a.version)[0];
      if (!workflow) throw new Error('Fluxo desconhecido');
      if (data.budget_minor > Math.min(workflow.budget_minor, state.agent.cap_minor)) throw new Error('Teto excede o permitido pelo agente ou fluxo');
      if (data.mode === 'model' && !data.model) throw new Error('Escolha um modelo local');
      const id = randomUUID();
      const action: Action = { tool: 'content.compose', task_id: id, input_hash: hash({ ...data, workflow }), destination: 'local', cost_minor: 0 };
      const task: Task = { ...data, id, workflow: structuredClone(workflow), state: 'draft', spent_minor: 0, reserved_minor: 0, action, grants: {}, versions: [], checks: [], notes: [], at: Date.now(), error: null, generation: 0, checkpoint_id: null };
      state.tasks.unshift(task); this.append(state, entries, 'task.created', task, 'human', id); return { id };
    });
  }
  actionFor(task: Task, tool: string): Action { return { ...task.action, tool, input_hash: hash({ contract_hash: task.action.input_hash, generation: task.generation }) }; }
  approveSteps(state: State, entries: Entry[], task: Task) {
    const human = this.actor(state, 'human'), agent = this.actor(state, 'agent');
    if (agent.revoked_seq !== null) throw new Error('Agente revogado');
    task.grants = {};
    for (const step of task.workflow.steps) {
      const action = this.actionFor(task, step.tool);
      const body = { human_id: human.id, agent_id: agent.id, log_id: state.log_id, task_id: task.id, action_hash: hash(action), epoch: agent.epoch, issued_at: Date.now(), expires_at: Date.now() + 10 * 60000 };
      const grant: Grant = { body, signature: signature(body, this.vault.key(human.id)) };
      judge(action, grant, agent, human, state.agent.scope, task.workflow, state.log_id);
      task.grants[step.tool] = grant;
      this.append(state, entries, 'approval.granted', grant, human.id, task.id);
    }
  }
  checkStep(state: State, entries: Entry[], task: Task, tool: string, type: string, payload: unknown) {
    const action = this.actionFor(task, tool), grant = task.grants[tool];
    judge(action, grant ?? null, this.actor(state, 'agent'), this.actor(state, 'human'), state.agent.scope, task.workflow, state.log_id);
    this.append(state, entries, type, payload, 'agent', task.id, action, grant);
  }
  async start(id: string, key: string) {
    const before = findTask(requireState(await this.store.read()), id);
    if (this.jobs.has(id) && before.state !== 'running') throw new Error('Aguarde a tentativa anterior encerrar antes de autorizar novamente');
    const result = await this.idempotent(key, { operation: 'start', id }, (state, entries) => {
      const task = findTask(state, id);
      if (!['draft','paused'].includes(task.state)) throw new Error('Estado não permite execução');
      task.generation++; this.approveSteps(state, entries, task);
      task.state = 'running'; task.error = null;
      this.append(state, entries, 'task.state', { state: task.state, generation: task.generation }, 'human', id);
      this.checkStep(state, entries, task, 'content.compose', 'policy.applied', { destination: 'local', model: task.model, mode: task.mode, input_hash: task.action.input_hash });
      const reservation = { id: `${id}:${task.generation}`, task_id: id, amount: 0, actual: null, state: 'reserved' as const };
      state.reservations.push(reservation);
      this.append(state, entries, 'spend.reserved', reservation, 'service', id);
      return { id, generation: task.generation };
    });
    const current = findTask(requireState(await this.store.read()), id);
    if (current.state === 'running' && current.generation === result.generation && !this.jobs.has(id)) {
      const controller = new AbortController();
      const promise = this.execute(id, result.generation, controller.signal).finally(() => this.jobs.delete(id));
      this.jobs.set(id, { controller, promise });
    }
    return result;
  }
  async execute(id: string, generation: number, signal: AbortSignal) {
    try {
      const task = findTask(requireState(await this.store.read()), id);
      if (signal.aborted || task.state !== 'running' || task.generation !== generation) return;
      const body = await this.composer(task, signal);
      await this.store.tx((s, entries) => {
        const state = requireState(s), task = findTask(state, id);
        if (signal.aborted || task.state !== 'running' || task.generation !== generation) return;
        this.checkStep(state, entries, task, 'content.compose', 'step.attempt', { output_hash: hash(body), generation });
        this.checkStep(state, entries, task, 'files.commit_version', 'asset.version', { hash: hash(body), previous_hash: task.versions.at(-1)?.hash ?? null });
        this.version(task, body);
        task.checks = validate(body, task);
        this.checkStep(state, entries, task, 'document.validate', 'delivery.checked', task.checks);
        task.state = 'review'; task.grants = {};
        const reservation = state.reservations.find(r => r.id === `${id}:${generation}`)!;
        reservation.actual = 0; reservation.state = 'settled';
        this.append(state, entries, 'spend.settled', reservation, 'service', id);
        this.append(state, entries, 'task.state', { state: task.state }, 'service', id);
      });
    } catch (error) {
      await this.store.tx((s, entries) => {
        const state = requireState(s), task = findTask(state, id);
        if (task.state !== 'running' || task.generation !== generation) return;
        task.state = 'paused'; task.grants = {}; task.error = error instanceof Error ? error.message : 'Falha na execução';
        for (const reservation of state.reservations.filter(r => r.task_id === id && r.state === 'reserved')) { task.reserved_minor -= reservation.amount; reservation.state = 'released'; this.append(state, entries, 'spend.released', reservation, 'service', id); }
        this.append(state, entries, 'action.denied', { reason: task.error }, 'service', id);
      });
    }
  }
  version(task: Task, body: string) {
    if (!body.trim() || Buffer.byteLength(body) > 262144) throw new Error('Arquivo vazio ou maior que 256 KB');
    const version = { id: randomUUID(), hash: hash(body), previous_hash: task.versions.at(-1)?.hash ?? null, body, at: Date.now() };
    task.versions.push(version); task.checkpoint_id = version.id;
  }
  async edit(id: string, body: string, expectedHash: string, key: string) {
    return this.idempotent(key, { operation: 'edit', id, body, expectedHash }, (state, entries) => {
      const task = findTask(state, id);
      if (!['review','validated'].includes(task.state)) throw new Error('Entrega não está disponível para edição');
      if (task.versions.at(-1)?.hash !== expectedHash) throw new Error('Conflito: existe uma versão mais recente. Recarregue antes de salvar.');
      this.version(task, body); task.state = 'review'; task.checks = validate(body, task);
      this.append(state, entries, 'asset.version', { hash: hash(body), previous_hash: expectedHash }, 'human', id); return { version: task.versions.at(-1)!.id };
    });
  }
  async restore(id: string, versionId: string, expectedHash: string, key: string) {
    const task = findTask(requireState(await this.store.read()), id);
    const version = task.versions.find(v => v.id === versionId); if (!version) throw new Error('Versão não encontrada');
    return this.edit(id, version.body, expectedHash, key);
  }
  async review(id: string, expectedHash: string, checks: string[], key: string) {
    return this.idempotent(key, { operation: 'review', id, expectedHash, checks }, (state, entries) => {
      const task = findTask(state, id);
      if (task.state !== 'review' || task.versions.at(-1)?.hash !== expectedHash) throw new Error('Versão mudou ou não está em revisão');
      if (!task.workflow.required_checks.every(check => checks.includes(check))) throw new Error('Confirme todas as verificações');
      if (/\[(?:descreva|escreva|descrever|redigir|conferir)/i.test(task.versions.at(-1)!.body)) throw new Error('Preencha os campos da estrutura antes de aprovar');
      task.checks = task.checks.map(check => ({ ...check, pass: true, detail: check.detail + ' Confirmado pelo responsável nesta versão.' })); task.state = 'validated';
      this.append(state, entries, 'delivery.validated', { asset_hash: expectedHash, checks: task.checks }, 'human', id); return { state: task.state };
    });
  }
  async pause(id: string, cancel = false) {
    this.jobs.get(id)?.controller.abort();
    return this.store.tx((s, entries) => {
      const state = requireState(s), task = findTask(state, id);
      if (['validated','cancelled'].includes(task.state)) throw new Error('Entrega já finalizada');
      task.generation++; task.state = cancel ? 'cancelled' : 'paused'; task.grants = {};
      for (const reservation of state.reservations.filter(r => r.task_id === id && r.state === 'reserved')) { task.reserved_minor -= reservation.amount; reservation.state = 'released'; this.append(state, entries, 'spend.released', reservation, 'service', id); }
      this.append(state, entries, 'approval.revoked', { state: task.state, generation: task.generation }, 'human', id);
    });
  }
  async revokeAgent() {
    for (const job of this.jobs.values()) job.controller.abort();
    await this.store.tx((s, entries) => {
      const state = requireState(s), agent = this.actor(state, 'agent');
      if (agent.revoked_seq !== null) return;
      agent.revoked_seq = entries.length + 1; agent.epoch++; state.agent.epoch++;
      this.append(state, entries, 'identity.revoked', { id: agent.id, epoch: agent.epoch }, 'human');
      for (const task of state.tasks.filter(t => t.state === 'running')) { task.state = 'paused'; task.generation++; task.grants = {}; task.error = 'Agente revogado pelo responsável'; this.releaseLocalReservations(state, entries, task); this.append(state, entries, 'task.state', { state: task.state }, 'human', task.id); }
    });
  }
  releaseLocalReservations(state: State, entries: Entry[], task: Task) {
    for (const reservation of state.reservations.filter(r => r.task_id === task.id && r.state === 'reserved')) { task.reserved_minor -= reservation.amount; reservation.state = 'released'; this.append(state, entries, 'spend.released', reservation, 'service', task.id); }
  }
  async registerWorkflow(source: string) {
    return this.store.tx((s, entries) => {
      const state = requireState(s), workflow = parseWorkflow(source, state.agent.scope);
      if (workflow.budget_minor > state.agent.cap_minor) throw new Error('Fluxo não pode ampliar orçamento');
      if (state.workflows.some(w => w.id === workflow.id && w.version === workflow.version)) throw new Error('Versão de fluxo é imutável');
      state.workflows.push(workflow); this.append(state, entries, 'workflow.registered', workflow); return workflow;
    });
  }
  async reserve(id: string, amount: number, key: string) {
    if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('Valor monetário inválido');
    return this.idempotent(key, { operation: 'reserve', id, amount }, (state, entries) => {
      const task = findTask(state, id);
      if (task.state !== 'running') throw new Error('Tarefa não está em execução');
      if (this.actor(state, 'agent').revoked_seq !== null) throw new Error('Agente revogado');
      const total = state.tasks.reduce((sum, t) => sum + t.spent_minor + t.reserved_minor, 0);
      if (task.spent_minor + task.reserved_minor + amount > Math.min(task.budget_minor, task.workflow.budget_minor) || total + amount > state.agent.cap_minor) throw new Error('Saldo insuficiente: chamada bloqueada antes do efeito');
      const reservation = { id: randomUUID(), task_id: id, amount, actual: null, state: 'reserved' as const };
      state.reservations.push(reservation); task.reserved_minor += amount;
      this.append(state, entries, 'spend.reserved', reservation, 'service', id); return { id: reservation.id };
    });
  }
  async settle(reservationId: string, actual: number) {
    if (!Number.isSafeInteger(actual) || actual < 0) throw new Error('Valor monetário inválido');
    return this.store.tx((s, entries) => {
      const state = requireState(s), reservation = state.reservations.find(r => r.id === reservationId);
      if (!reservation) throw new Error('Reserva desconhecida');
      if (reservation.state === 'settled') { if (reservation.actual !== actual) throw new Error('Conciliação divergente'); return; }
      if (reservation.state !== 'reserved' || actual > reservation.amount) throw new Error('Liquidação excede reserva ou reserva foi liberada');
      const task = findTask(state, reservation.task_id);
      task.reserved_minor -= reservation.amount; task.spent_minor += actual; reservation.actual = actual; reservation.state = 'settled';
      this.append(state, entries, 'spend.settled', reservation, 'service', task.id);
    });
  }
  async export() {
    return this.store.tx((s, entries) => {
      const state = requireState(s), rootPublicKey = createPublicKey(this.vault.key('organization')).export({ type: 'spki', format: 'pem' }).toString();
      const manifest = { log_id: state.log_id, head_seq: entries.length, head_hash: entries.at(-1)?.entry_hash ?? '0'.repeat(64), identities_hash: hash(state.identities), exported_at: Date.now() };
      const bundle = { format: 'colmeia.audit.v1', root_public_key: rootPublicKey, identities: state.identities, manifest, manifest_signature: signature(manifest, this.vault.key('organization')), entries };
      const result = verifyPackage(bundle, fingerprint(rootPublicKey));
      if (!result.valid) throw new Error(`Cadeia inválida: ${'reason' in result ? result.reason : 'erro'}`);
      return bundle;
    });
  }
  async wait(id: string) { await this.jobs.get(id)?.promise; }
  async close() { for (const job of this.jobs.values()) job.controller.abort(); await Promise.allSettled([...this.jobs.values()].map(j => j.promise)); this.vault.lock(); await this.store.close(); }
}
