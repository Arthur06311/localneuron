import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  existsSync,
  ftruncateSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, relative, resolve } from 'node:path';
import { Core } from '../src/core.js';
import { ModelLibrary } from '../src/model-library.js';
import { LocalRuntime, type RuntimeModel } from '../src/runtime.js';
import { otherAiBlocksQuantize, quantizationBlocksRequest, createApp } from '../src/server.js';
import { mergeLibraryProgress } from '../public/library-progress.js';
import {
  GGUF_BPW,
  PRESETS,
  Quantizer,
  assertInsideModels,
  destinationInside,
  estimateOutputBytes,
  estimateUseRam,
  mapPreset,
  mlxBitsPerWeight,
  modelsRoot,
  readGgufFileType,
  releaseQuantizeChildren,
  toolBeside,
  type ProcessLauncher,
  type QuantJob,
  type QuantProcess,
  type QuantTarget,
} from '../src/quantize.js';

const GiB = 1024 ** 3;

function gguf(fileType: number | null) {
  if (fileType === null) {
    const header = Buffer.alloc(24);
    header.writeUInt32LE(0x46554747, 0);
    header.writeUInt32LE(3, 4);
    header.writeBigUInt64LE(0n, 8);
    header.writeBigUInt64LE(0n, 16);
    return header;
  }
  const key = Buffer.from('general.file_type');
  const header = Buffer.alloc(24 + 8 + key.length + 8);
  header.writeUInt32LE(0x46554747, 0);
  header.writeUInt32LE(3, 4);
  header.writeBigUInt64LE(0n, 8);
  header.writeBigUInt64LE(1n, 16);
  let offset = 24;
  header.writeBigUInt64LE(BigInt(key.length), offset);
  offset += 8;
  key.copy(header, offset);
  offset += key.length;
  header.writeUInt32LE(4, offset);
  offset += 4;
  header.writeUInt32LE(fileType, offset);
  return header;
}

function writeGguf(path: string, fileType: number | null, bytes = 4096) {
  const header = gguf(fileType);
  writeFileSync(path, header);
  if (bytes > header.length) {
    const fd = openSync(path, 'r+');
    try { ftruncateSync(fd, bytes); } finally { closeSync(fd); }
  }
}

type Pending = { emitOut: (text: string) => void; emitErr: (text: string) => void; exit: (code: number) => void };

function mockLauncher() {
  const calls: { command: string; args: string[]; options: { shell: false; cwd: string; env: NodeJS.ProcessEnv; signal: AbortSignal } }[] = [];
  const pending: Pending[] = [];
  const launch: ProcessLauncher = (command, args, options) => {
    assert.equal(options.shell, false);
    assert.equal(Array.isArray(args), true);
    calls.push({ command, args: [...args], options });
    const stdout = new EventEmitter();
    const stderr = new EventEmitter();
    const events = new EventEmitter();
    const partial = args.find(arg => basename(arg).startsWith('.partial-'));
    if (basename(command).startsWith('llama-imatrix')) writeFileSync(args[args.indexOf('-o') + 1], Buffer.from('imatrix-fixture'));
    if (basename(command).startsWith('llama-quantize') && partial) writeFileSync(partial, Buffer.from('quantized-fixture'));
    if (args.includes('--mlx-path')) {
      const dir = args[args.indexOf('--mlx-path') + 1];
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'model.safetensors'), Buffer.from('safetensors-fixture'));
    }
    options.signal.addEventListener('abort', () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      events.emit('error', error);
    });
    pending.push({
      emitOut: text => stdout.emit('data', Buffer.from(text)),
      emitErr: text => stderr.emit('data', Buffer.from(text)),
      exit: code => events.emit('exit', code, null),
    });
    return { stdout, stderr, on: events.on.bind(events) } as unknown as QuantProcess;
  };
  return { calls, pending, launch };
}

function tools(dir: string) {
  const bin = join(dir, 'bin');
  mkdirSync(bin, { recursive: true });
  const quantize = join(bin, 'llama-quantize');
  const imatrix = join(bin, 'llama-imatrix');
  const calibration = join(dir, 'quantize-calibration.txt');
  const python = join(bin, 'python3');
  writeFileSync(quantize, '');
  writeFileSync(imatrix, '');
  writeFileSync(calibration, 'amostra local');
  writeFileSync(python, '');
  chmodSync(quantize, 0o755);
  chmodSync(imatrix, 0o755);
  chmodSync(python, 0o755);
  return { quantize, imatrix, mlxPython: python, mlxAvailable: false, calibration };
}

function layout() {
  const dir = mkdtempSync(join(tmpdir(), 'quantize-'));
  const models = join(dir, 'models');
  mkdirSync(models, { recursive: true });
  return { dir, models, tool: tools(dir) };
}

function target(models: string, name: string, format: 'GGUF' | 'MLX' = 'GGUF'): QuantTarget {
  return { key: format === 'MLX' ? 'mlx:teste' : 'gguf:teste', format, path: join(models, name) };
}

async function until(quantizer: Quantizer, done: (job: QuantJob | null) => boolean) {
  for (let i = 0; i < 40; i++) {
    const job = quantizer.view();
    if (done(job)) return job;
    await new Promise(resolve => setImmediate(resolve));
  }
  throw new Error('estado inesperado: ' + JSON.stringify(quantizer.view()));
}

test('Presets mapeiam rótulos e o formato exato', () => {
  assert.deepEqual(mapPreset('equilibrado', 'GGUF'), { id: 'equilibrado', label: 'Equilibrado (recomendado)', detail: 'GGUF Q4_K_M · imatrix', bpw: GGUF_BPW.Q4_K_M, type: 'Q4_K_M', imatrix: true, bits: undefined, group: undefined, predicate: undefined });
  assert.equal(mapPreset('menor', 'GGUF').detail, 'GGUF IQ4_XS · imatrix');
  assert.equal(mapPreset('menor', 'GGUF').type, 'IQ4_XS');
  assert.equal(mapPreset('qualidade', 'GGUF').detail, 'GGUF Q6_K');
  assert.equal(mapPreset('qualidade', 'GGUF').imatrix, false);
  assert.equal(mapPreset('equilibrado', 'MLX').detail, 'MLX 4 bits · grupo 64');
  assert.equal(mapPreset('equilibrado', 'MLX').bits, 4);
  assert.equal(mapPreset('equilibrado', 'MLX').group, 64);
  assert.equal(mapPreset('menor', 'MLX').detail, 'MLX 4 bits · grupo 128');
  assert.equal(mapPreset('menor', 'MLX').group, 128);
  assert.equal(mapPreset('qualidade', 'MLX').detail, 'MLX misto 4 e 6 bits');
  assert.equal(mapPreset('qualidade', 'MLX').predicate, 'mixed_4_6');
  assert.equal(PRESETS.equilibrado.label, 'Equilibrado (recomendado)');
  assert.equal(PRESETS.menor.label, 'Menor tamanho');
  assert.equal(PRESETS.qualidade.label, 'Máxima qualidade');
});

test('O quantizador fica ao lado do llama-server', () => {
  assert.equal(toolBeside('/opt/runtime/llama-b10809/llama-server', 'llama-quantize'), '/opt/runtime/llama-b10809/llama-quantize');
  assert.equal(toolBeside('/opt/runtime/llama-b10809/llama-server', 'llama-imatrix'), '/opt/runtime/llama-b10809/llama-imatrix');
  assert.equal(toolBeside('C:\\runtime\\llama-server.exe', 'llama-quantize'), 'C:\\runtime\\llama-quantize.exe');
  assert.throws(() => toolBeside('/opt/runtime/llama-cli', 'llama-quantize'), /llama\.cpp/);
});

test('Estimativa de tamanho e de RAM segue os bits por peso e a folga de carga', () => {
  const output = estimateOutputBytes(16_000_500, GGUF_BPW.F16, GGUF_BPW.Q4_K_M);
  assert.equal(output, Math.max(1, Math.ceil((16_000_500 * GGUF_BPW.Q4_K_M) / GGUF_BPW.F16)));
  assert.equal(estimateUseRam(output, 'GGUF'), Math.ceil(output * 1.25 + GiB));
  assert.equal(estimateUseRam(output, 'MLX'), Math.ceil(output + 0.5 * GiB));
  assert.equal(mlxBitsPerWeight(4, 64), 4.5);
  assert.equal(mlxBitsPerWeight(4, 128), 4.25);
  assert.throws(() => estimateOutputBytes(0, 16, 4), /estimar/);
});

test('Metadados GGUF identificam a origem e o nome não substitui um tipo já quantizado', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gguf-type-'));
  try {
    const f16 = join(dir, 'modelo.gguf');
    writeGguf(f16, 1);
    assert.equal(readGgufFileType(f16), 1);
    writeGguf(join(dir, 'modelo-F16.gguf'), null);
    assert.equal(readGgufFileType(join(dir, 'modelo-F16.gguf')), null);
    writeGguf(join(dir, 'modelo-Q4_K_M.gguf'), 15);
    assert.equal(readGgufFileType(join(dir, 'modelo-Q4_K_M.gguf')), 15);
    writeFileSync(join(dir, 'vazio.txt'), 'texto');
    assert.throws(() => readGgufFileType(join(dir, 'vazio.txt')), /não é um GGUF/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('Caminhos permanecem na pasta de modelos', () => {
  const { dir, models } = layout();
  try {
    const inside = join(models, 'modelo-F16.gguf');
    writeGguf(inside, 1);
    assert.equal(assertInsideModels(models, inside), inside);
    const outside = join(dir, 'fora.gguf');
    writeGguf(outside, 1);
    assert.throws(() => assertInsideModels(models, outside), /pasta de modelos/);
    assert.throws(() => assertInsideModels(models, join(models, '..', 'fora.gguf')), /pasta de modelos/);
    const kept = destinationInside(models, '.partial-abc.gguf');
    assert.equal(basename(kept).startsWith('.partial-'), true);
    assert.equal(relative(models, kept).split(/[/\\]/).includes('..'), false);
    const escaped = destinationInside(models, '../segredo.gguf');
    assert.equal(relative(models, escaped).startsWith('..'), false);
    assert.equal(escaped.startsWith(models), true);
    assert.throws(() => destinationInside(models, 'foo/../../etc'), /inválido|saída/);
    const link = join(models, 'atalho.gguf');
    try { symlinkSync(outside, link); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'EPERM') return; throw error; }
    assert.throws(() => assertInsideModels(models, link), /pasta de modelos/);
    const linkedRoot = join(dir, 'atalho-modelos');
    symlinkSync(models, linkedRoot);
    assert.throws(() => modelsRoot(linkedRoot), /não está disponível/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('F16 com RAM e disco estima Q4_K_M com imatrix e recusa o que já está quantizado', () => {
  const { dir, models, tool } = layout();
  const harness = mockLauncher();
  const quantizer = new Quantizer(models, tool, { launch: harness.launch, memoryAvailable: () => 32 * GiB, diskFree: () => 32 * GiB });
  try {
    writeGguf(join(models, 'modelo-F16.gguf'), 1, 8192);
    const estimate = quantizer.estimate(target(models, 'modelo-F16.gguf'), 'equilibrado');
    assert.equal(estimate.eligible, true);
    assert.equal(estimate.detail, 'GGUF Q4_K_M · imatrix');
    assert.equal(estimate.imatrix, true);
    assert.equal(estimate.label, 'Equilibrado (recomendado)');
    assert.equal(estimate.output_bytes, estimateOutputBytes(8192, GGUF_BPW.F16, GGUF_BPW.Q4_K_M));
    assert.equal(estimate.ram_bytes, estimateUseRam(estimate.output_bytes!, 'GGUF'));
    writeGguf(join(models, 'modelo-Q4_K_M.gguf'), 15, 8192);
    const again = quantizer.estimate(target(models, 'modelo-Q4_K_M.gguf'), 'equilibrado');
    assert.equal(again.eligible, false);
    assert.match(again.error || '', /Q4_K_M/);
    assert.throws(() => quantizer.start(target(models, 'modelo-Q4_K_M.gguf'), 'equilibrado'), /Q4_K_M/);
    assert.equal(harness.calls.length, 0);
    writeGguf(join(models, 'modelo-F16-falso.gguf'), 15, 8192);
    assert.equal(quantizer.estimate(target(models, 'modelo-F16-falso.gguf'), 'equilibrado').eligible, false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('Q8_0 pede requantização e a falta de disco ou de caminho interno impede o processo', () => {
  const { dir, models, tool } = layout();
  const harness = mockLauncher();
  const roomy = new Quantizer(models, tool, { launch: harness.launch, memoryAvailable: () => 32 * GiB, diskFree: () => 32 * GiB });
  writeGguf(join(models, 'modelo-Q8_0.gguf'), 7, 8192);
  const estimate = roomy.estimate(target(models, 'modelo-Q8_0.gguf'), 'equilibrado');
  assert.equal(estimate.eligible, true);
  assert.match(estimate.note, /Q8_0/);
  const tight = new Quantizer(models, tool, { launch: harness.launch, memoryAvailable: () => 32 * GiB, diskFree: () => 100 });
  assert.throws(() => tight.start(target(models, 'modelo-Q8_0.gguf'), 'equilibrado'), /disco/);
  const outside = join(dir, 'externo-F16.gguf');
  writeGguf(outside, 1, 8192);
  assert.throws(() => roomy.start({ key: 'gguf:fora', format: 'GGUF', path: outside }, 'equilibrado'), /pasta de modelos/);
  assert.equal(harness.calls.length, 0);
  rmSync(dir, { recursive: true, force: true });
});

test('Pouca RAM pula a imatrix e menos RAM ainda recusa o trabalho', () => {
  const { dir, models, tool } = layout();
  writeGguf(join(models, 'grande-F16.gguf'), 1, 8192);
  const quantRam = 8192 + GiB;
  const imatrixRam = Math.ceil(8192 * 1.25 + GiB);
  const skipped = new Quantizer(models, tool, { memoryAvailable: () => quantRam + 100, diskFree: () => 32 * GiB });
  const estimate = skipped.estimate(target(models, 'grande-F16.gguf'), 'equilibrado');
  assert.ok(quantRam + 100 < imatrixRam);
  assert.equal(estimate.eligible, true);
  assert.equal(estimate.imatrix, false);
  assert.equal(estimate.detail, 'GGUF Q4_K_M · sem imatrix');
  const blocked = new Quantizer(models, tool, { memoryAvailable: () => quantRam - 1, diskFree: () => 32 * GiB });
  assert.equal(blocked.estimate(target(models, 'grande-F16.gguf'), 'equilibrado').eligible, false);
  rmSync(dir, { recursive: true, force: true });
});

test('O job GGUF conclui, cancela e falha sem shell e sem apagar a origem', async () => {
  const { dir, models, tool } = layout();
  const harness = mockLauncher();
  const quantizer = new Quantizer(models, tool, { launch: harness.launch, memoryAvailable: () => 32 * GiB, diskFree: () => 32 * GiB });
  const source = join(models, 'modelo-F16.gguf');
  writeGguf(source, 1, 8192);
  try {
    const started = quantizer.start(target(models, 'modelo-F16.gguf'), 'equilibrado');
    assert.equal(started.state, 'imatrix');
    assert.throws(() => quantizer.start(target(models, 'modelo-F16.gguf'), 'equilibrado'), /em andamento/);
    assert.equal(harness.calls[0].options.shell, false);
    assert.match(basename(harness.calls[0].command), /^llama-imatrix/);
    assert.equal(['sh', 'bash', 'cmd', 'cmd.exe'].includes(basename(harness.calls[0].command)), false);
    harness.pending[0].emitOut('[ 1/2 ]');
    harness.pending[0].exit(0);
    await until(quantizer, () => harness.calls.length === 2);
    const quantize = harness.calls[1];
    assert.match(basename(quantize.command), /^llama-quantize/);
    assert.equal(quantize.args.includes('--allow-requantize'), false);
    assert.equal(quantize.args.includes('Q4_K_M'), true);
    assert.equal(quantize.args.some(arg => basename(arg).startsWith('.partial-')), true);
    assert.equal(quantize.options.env.HF_HUB_OFFLINE, '1');
    harness.pending[1].emitOut('[ 2/2 ]');
    harness.pending[1].exit(0);
    const done = await until(quantizer, job => job?.state === 'done');
    assert.equal(done?.progress, 100);
    assert.equal(existsSync(source), true);
    assert.equal(readFileSync(source).subarray(0, 4).toString(), 'GGUF');
    const produced = readdirSync(join(models, 'quantized'));
    assert.deepEqual(produced, ['modelo-Q4_K_M.gguf']);
    assert.equal(produced.some(name => name.startsWith('.')), false);
    assert.equal(existsSync(quantize.args.find(arg => basename(arg).startsWith('.partial-'))!), false);
    quantizer.clear();
    assert.equal(quantizer.view(), null);

    writeGguf(join(models, 'modelo-Q8_0.gguf'), 7, 8192);
    quantizer.start({ key: 'gguf:q8', format: 'GGUF', path: join(models, 'modelo-Q8_0.gguf') }, 'menor');
    await until(quantizer, () => harness.calls.length === 3);
    harness.pending[2].exit(0);
    await until(quantizer, () => harness.calls.length === 4);
    assert.equal(harness.calls[3].args.includes('--allow-requantize'), true);
    assert.equal(harness.calls[3].args.includes('IQ4_XS'), true);
    await quantizer.cancel();
    const cancelled = await until(quantizer, job => job?.state === 'cancelled');
    assert.match(cancelled?.error || '', /original foi mantido/);
    assert.equal(existsSync(join(models, 'modelo-Q8_0.gguf')), true);
    assert.equal(readdirSync(join(models, 'quantized')).some(name => name.startsWith('.')), false);
    quantizer.clear();

    quantizer.start(target(models, 'modelo-F16.gguf'), 'qualidade');
    await until(quantizer, () => harness.calls.length === 5);
    assert.equal(harness.calls[4].args.includes('--imatrix'), false);
    assert.equal(harness.calls[4].args.includes('Q6_K'), true);
    harness.pending[4].emitErr('falha de teste do quantizador');
    harness.pending[4].exit(1);
    const failed = await until(quantizer, job => job?.state === 'failed');
    assert.match(failed?.error || '', /não foi concluída/);
    assert.match(failed?.error || '', /falha de teste/);
    assert.equal(existsSync(source), true);
    assert.equal(readdirSync(join(models, 'quantized')).includes('modelo-Q6_K.gguf'), false);
  } finally {
    if (quantizer.running) await quantizer.cancel();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('MLX usa o Python embutido, o predicado misto e o sandbox sem rede', async () => {
  const { dir, models, tool } = layout();
  tool.mlxAvailable = true;
  const folder = join(models, 'modelo');
  mkdirSync(folder);
  writeFileSync(join(folder, 'config.json'), '{}\n');
  writeFileSync(join(folder, 'weights.safetensors'), Buffer.alloc(2048));
  const harness = mockLauncher();
  const quantizer = new Quantizer(models, tool, { launch: harness.launch, memoryAvailable: () => 32 * GiB, diskFree: () => 32 * GiB, sandbox: false });
  try {
    const estimate = quantizer.estimate({ key: 'mlx:modelo', format: 'MLX', path: folder }, 'equilibrado');
    assert.equal(estimate.eligible, true);
    assert.equal(estimate.detail, 'MLX 4 bits · grupo 64');
    assert.equal(estimate.ram_bytes, estimateUseRam(estimate.output_bytes!, 'MLX'));
    quantizer.start({ key: 'mlx:modelo', format: 'MLX', path: folder }, 'equilibrado');
    assert.equal(harness.calls.length, 1);
    const call = harness.calls[0];
    assert.equal(call.command, tool.mlxPython);
    assert.deepEqual(call.args.slice(0, 6), ['-I', '-B', '-m', 'mlx_lm', 'convert', '--hf-path']);
    assert.equal(call.args.includes('-q'), true);
    assert.equal(call.args[call.args.indexOf('--q-bits') + 1], '4');
    assert.equal(call.args[call.args.indexOf('--q-group-size') + 1], '64');
    assert.equal(call.args.includes('--upload-repo'), false);
    assert.equal(call.args.includes('--trust-remote-code'), false);
    assert.equal(call.options.env.HF_HUB_OFFLINE, '1');
    assert.equal(call.options.env.TRANSFORMERS_OFFLINE, '1');
    assert.equal(call.options.shell, false);
    harness.pending[0].emitOut('[INFO] Loading\n[INFO] Quantizing\n');
    harness.pending[0].exit(0);
    const done = await until(quantizer, job => job?.state === 'done');
    assert.equal(done?.output_name, 'modelo-4bit');
    assert.equal(existsSync(join(models, 'quantized', 'modelo-4bit', 'model.safetensors')), true);
    assert.equal(existsSync(join(folder, 'weights.safetensors')), true);
    quantizer.clear();

    const sandboxed = new Quantizer(models, tool, { launch: harness.launch, memoryAvailable: () => 32 * GiB, diskFree: () => 32 * GiB, sandbox: true });
    sandboxed.start({ key: 'mlx:modelo', format: 'MLX', path: folder }, 'qualidade');
    const guarded = harness.calls[1];
    assert.equal(guarded.command, '/usr/bin/sandbox-exec');
    assert.equal(guarded.args[0], '-p');
    assert.match(guarded.args[1], /deny network-outbound/);
    assert.equal(guarded.args.includes(tool.mlxPython), true);
    assert.equal(guarded.args.includes('mixed_4_6'), true);
    assert.equal(guarded.args.includes('--quant-predicate'), true);
    harness.pending[1].exit(0);
    await until(sandboxed, job => job?.state === 'done');

    writeFileSync(join(folder, 'config.json'), JSON.stringify({ quantization: { bits: 4, group_size: 64 } }));
    assert.equal(quantizer.estimate({ key: 'mlx:modelo', format: 'MLX', path: folder }, 'equilibrado').eligible, false);
    const linux = new Quantizer(models, { ...tool, mlxAvailable: false }, { memoryAvailable: () => 32 * GiB, diskFree: () => 32 * GiB });
    assert.match(linux.estimate({ key: 'mlx:modelo', format: 'MLX', path: folder }, 'equilibrado').error || '', /Python/);
  } finally {
    if (quantizer.running) await quantizer.cancel();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('A interface e a rota autenticada expõem a quantização', async () => {
  const appJs = readFileSync(resolve('public/app.js'), 'utf8');
  const html = readFileSync(resolve('public/index.html'), 'utf8');
  execFileSync(process.execPath, ['--check', resolve('public/app.js')], { stdio: 'pipe' });
  for (const label of ['Equilibrado (recomendado)', 'Menor tamanho', 'Máxima qualidade']) assert.equal(appJs.includes(label), true);
  assert.match(html, /id="quantize-model"/);
  assert.match(html, /id="quantize-progress-bar"/);
  assert.match(appJs, /data-quantize-cancel/);
  assert.match(appJs, /<progress data-quantize-bar/);
  assert.equal(appJs.includes('data-quantize-bar style='), false);
  const merged = mergeLibraryProgress(
    { revision: 'a', quantize: null, catalog: [], media_downloads: { busy: false, jobs: [] }, studio_download: null, busy: false, disk_free_bytes: 1, available_memory_bytes: 1, total_memory_bytes: 1 },
    { revision: 'a', quantize: { state: 'quantizing', progress: 12 }, jobs: [], media_downloads: { busy: false, jobs: [] }, studio_download: null, busy: false, disk_free_bytes: 2, available_memory_bytes: 2, total_memory_bytes: 2 },
  );
  assert.equal(merged.status.quantize.state, 'quantizing');
  assert.equal(merged.refreshCatalog, false);

  const dir = mkdtempSync(join(tmpdir(), 'quantize-route-'));
  const core = new Core(dir, resolve('.'));
  await core.init();
  await core.setup('senha-fixture-quantizar');
  const { app } = await createApp(core, 'quantize-token');
  const headers = { host: '127.0.0.1:4317', authorization: 'Bearer quantize-token' };
  try {
    assert.equal((await app.inject({ method: 'GET', url: '/v1/model-library/quantize', headers: { host: headers.host } })).statusCode, 401);
    assert.equal((await app.inject({ method: 'POST', url: '/v1/model-library/quantize/estimate', headers: { ...headers, origin: 'https://evil.example' }, payload: { key: 'gguf:ausente', preset: 'equilibrado' } })).statusCode, 403);
    assert.equal((await app.inject({ method: 'GET', url: '/v1/model-library/quantize', headers })).json(), null);
    const missing = await app.inject({ method: 'POST', url: '/v1/model-library/quantize/estimate', headers, payload: { key: 'gguf:ausente', preset: 'equilibrado' } });
    assert.equal(missing.statusCode, 400);
    assert.match(missing.json().error, /GGUF ou MLX/);
    const progress = await app.inject({ method: 'GET', url: '/v1/model-library/progress', headers });
    assert.equal(progress.statusCode, 200);
    assert.equal(Object.prototype.hasOwnProperty.call(progress.json(), 'quantize'), true);
  } finally {
    await app.close();
    await core.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('A amostra local e a comparação estão no repositório e no pacote', () => {
  const sample = readFileSync(resolve('runtime/quantize-calibration.txt'), 'utf8');
  assert.ok(sample.length > 8000);
  assert.match(sample, /calibração|quantização/i);
  const doc = readFileSync(resolve('docs/quantizacao.md'), 'utf8');
  assert.match(doc, /Q4_K_M/);
  assert.match(doc, /mixed_4_6/);
  assert.match(doc, /llama-quantize/);
  assert.match(doc, /salvar o resultado/);
  assert.equal(doc.includes('guardar o resultado'), false);
  const desktop = readFileSync(resolve('scripts/package-desktop.mjs'), 'utf8');
  const mac = readFileSync(resolve('scripts/package-macos.py'), 'utf8');
  assert.match(desktop, /quantize-calibration\.txt/);
  assert.match(mac, /quantize-calibration\.txt/);
  assert.equal(createHash('sha256').update(sample).digest('hex').length, 64);
});

function stubbornLauncher(signals: string[], dieOnKill: boolean) {
  const launch: ProcessLauncher = (command, args, options) => {
    assert.equal(options.shell, false);
    const events = new EventEmitter();
    const partial = args.find(arg => basename(arg).startsWith('.partial-'));
    if (partial) writeFileSync(partial, Buffer.from('quantized-fixture'));
    if (args.includes('--mlx-path')) {
      const dir = args[args.indexOf('--mlx-path') + 1];
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'model.safetensors'), Buffer.from('safetensors-fixture'));
    }
    return {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      on: events.on.bind(events),
      kill(signal: NodeJS.Signals = 'SIGTERM') {
        signals.push(signal);
        if (dieOnKill && signal === 'SIGKILL') events.emit('exit', null, 'SIGKILL');
        return true;
      },
    } as unknown as QuantProcess;
  };
  return launch;
}

test('A RAM é medida de novo antes de cada processo', async () => {
  const { dir, models, tool } = layout();
  const harness = mockLauncher();
  let reads = 0;
  const quantizer = new Quantizer(models, tool, {
    launch: harness.launch,
    memoryAvailable: () => {
      reads += 1;
      return reads < 3 ? 32 * GiB : 1024;
    },
    diskFree: () => 32 * GiB,
  });
  writeGguf(join(models, 'modelo-F16.gguf'), 1, 8192);
  try {
    quantizer.start(target(models, 'modelo-F16.gguf'), 'equilibrado');
    assert.equal(harness.calls.length, 1);
    assert.match(basename(harness.calls[0].command), /^llama-imatrix/);
    harness.pending[0].exit(0);
    const failed = await until(quantizer, job => job?.state === 'failed');
    assert.match(failed?.error || '', /RAM livre insuficiente/);
    assert.equal(harness.calls.length, 1);
    assert.ok(reads >= 3);
    assert.equal(existsSync(join(models, 'modelo-F16.gguf')), true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('Queda de RAM antes da primeira etapa não cria processo', async () => {
  const { dir, models, tool } = layout();
  const harness = mockLauncher();
  let reads = 0;
  const quantizer = new Quantizer(models, tool, {
    launch: harness.launch,
    memoryAvailable: () => {
      reads += 1;
      return reads === 1 ? 32 * GiB : 1024;
    },
    diskFree: () => 32 * GiB,
  });
  writeGguf(join(models, 'modelo-F16.gguf'), 1, 8192);
  try {
    quantizer.start(target(models, 'modelo-F16.gguf'), 'equilibrado');
    const failed = await until(quantizer, job => job?.state === 'failed');
    assert.match(failed?.error || '', /RAM livre insuficiente/);
    assert.equal(harness.calls.length, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('O erro do job oculta caminho pessoal vindo do quantizador', async () => {
  const { dir, models, tool } = layout();
  const harness = mockLauncher();
  const quantizer = new Quantizer(models, tool, { launch: harness.launch, memoryAvailable: () => 32 * GiB, diskFree: () => 32 * GiB });
  writeGguf(join(models, 'modelo-F16.gguf'), 1, 8192);
  try {
    quantizer.start(target(models, 'modelo-F16.gguf'), 'qualidade');
    harness.pending[0].emitErr('falha ao abrir /home/ada/modelos/secreto.gguf');
    harness.pending[0].exit(1);
    const failed = await until(quantizer, job => job?.state === 'failed');
    assert.match(failed?.error || '', /não foi concluída/);
    assert.match(failed?.error || '', /~\/…/);
    assert.doesNotMatch(failed?.error || '', /\/home\/ada/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('Cancelar envia SIGTERM e, no prazo, SIGKILL, e não fica pendurado', async () => {
  const { dir, models, tool } = layout();
  const signals: string[] = [];
  const quantizer = new Quantizer(models, tool, {
    launch: stubbornLauncher(signals, true),
    memoryAvailable: () => 32 * GiB,
    diskFree: () => 32 * GiB,
    termGraceMs: 20,
    killGraceMs: 20,
  });
  writeGguf(join(models, 'modelo-F16.gguf'), 1, 8192);
  try {
    quantizer.start(target(models, 'modelo-F16.gguf'), 'qualidade');
    const raced = await Promise.race([
      quantizer.cancel().then(job => job?.state ?? 'vazio'),
      new Promise<string>(resolve => setTimeout(() => resolve('pendurado'), 1000)),
    ]);
    assert.equal(raced, 'cancelled');
    assert.equal(signals[0], 'SIGTERM');
    assert.equal(signals.includes('SIGKILL'), true);
    assert.equal(quantizer.running, false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('Cancelar retorna mesmo se o processo ignorar SIGKILL', async () => {
  const { dir, models, tool } = layout();
  const signals: string[] = [];
  const quantizer = new Quantizer(models, tool, {
    launch: stubbornLauncher(signals, false),
    memoryAvailable: () => 32 * GiB,
    diskFree: () => 32 * GiB,
    termGraceMs: 15,
    killGraceMs: 15,
  });
  writeGguf(join(models, 'modelo-F16.gguf'), 1, 8192);
  try {
    quantizer.start(target(models, 'modelo-F16.gguf'), 'qualidade');
    const raced = await Promise.race([
      quantizer.cancel().then(job => job?.state ?? 'vazio'),
      new Promise<string>(resolve => setTimeout(() => resolve('pendurado'), 1000)),
    ]);
    assert.equal(raced, 'cancelled');
    assert.equal(signals.includes('SIGTERM'), true);
    assert.equal(signals.includes('SIGKILL'), true);
    releaseQuantizeChildren();
    assert.equal(signals.at(-1), 'SIGKILL');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('Sair do processo mata o quantizador que ainda estiver vivo', async () => {
  const { dir, models, tool } = layout();
  const signals: string[] = [];
  const quantizer = new Quantizer(models, tool, {
    launch: stubbornLauncher(signals, true),
    memoryAvailable: () => 32 * GiB,
    diskFree: () => 32 * GiB,
    termGraceMs: 5000,
    killGraceMs: 5000,
  });
  writeGguf(join(models, 'modelo-F16.gguf'), 1, 8192);
  try {
    quantizer.start(target(models, 'modelo-F16.gguf'), 'qualidade');
    assert.equal(quantizer.running, true);
    releaseQuantizeChildren();
    assert.equal(signals.includes('SIGKILL'), true);
    const stopped = await until(quantizer, job => job?.state === 'failed' || job?.state === 'cancelled');
    assert.equal(quantizer.running, false);
    assert.equal(existsSync(join(models, 'modelo-F16.gguf')), true);
    assert.equal(stopped?.state === 'failed' || stopped?.state === 'cancelled', true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('Instalar, importar e parar respeitam a quantização em andamento', async () => {
  const data = mkdtempSync(join(tmpdir(), 'quantize-lib-'));
  const bin = join(data, 'bin');
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, 'llama-server'), '');
  writeFileSync(join(bin, 'llama-quantize'), '');
  writeFileSync(join(bin, 'llama-imatrix'), '');
  mkdirSync(join(data, 'runtime'), { recursive: true });
  writeFileSync(join(data, 'runtime', 'quantize-calibration.txt'), 'amostra');
  mkdirSync(join(data, 'models'), { recursive: true });
  const source = join(data, 'models', 'modelo-F16.gguf');
  writeGguf(source, 1, 8192);
  const signals: string[] = [];
  const runtime = {
    binary: join(bin, 'llama-server'),
    mlxPython: join(bin, 'python3'),
    mlxAvailable: false,
    root: data,
    inventory: () => [{ key: 'gguf:teste', format: 'GGUF', path: source, loaded_instances: [] }],
    setCatalog() {},
    async close() {},
  } as unknown as LocalRuntime;
  const library = new ModelLibrary(data, async () => {}, null, runtime, () => undefined, process.env, {
    launch: stubbornLauncher(signals, true),
    memoryAvailable: () => 32 * GiB,
    diskFree: () => 32 * GiB,
    termGraceMs: 20,
    killGraceMs: 20,
  });
  try {
    library.quantizeModel('gguf:teste', 'qualidade');
    assert.equal(library.quantizer.running, true);
    await assert.rejects(() => library.install('ausente'), /quantização/);
    await assert.rejects(() => library.download('ausente'), /quantização/);
    library.assertQuantizeIdle();
  } catch (error) {
    assert.match((error as Error).message, /quantização/);
  }
  try {
    const raced = await Promise.race([
      library.stop().then(() => 'parou'),
      new Promise<string>(resolve => setTimeout(() => resolve('pendurado'), 1000)),
    ]);
    assert.equal(raced, 'parou');
    assert.equal(signals[0], 'SIGTERM');
    assert.equal(signals.includes('SIGKILL'), true);
    assert.equal(library.quantizer.running, false);
    await assert.rejects(() => library.install('ausente'), /catálogo/);
  } finally { rmSync(data, { recursive: true, force: true }); }
});

test('A quantização espera música, Editor e mídia, e o cancelamento fica fora do 409', async () => {
  const idle = { chats: false, api: false, apiBusy: false, aux: false, pro: false, jobs: 0, music: false, editor: false, media: false };
  assert.equal(otherAiBlocksQuantize(idle), '');
  for (const busy of [
    { chats: true },
    { api: true },
    { apiBusy: true },
    { aux: true },
    { pro: true },
    { jobs: 2 },
    { music: true },
    { editor: true },
    { media: true },
  ]) assert.match(otherAiBlocksQuantize({ ...idle, ...busy }), /Aguarde a conversa, a Minha API ou a outra IA terminar antes de quantizar/);
  assert.equal(quantizationBlocksRequest(true, 'POST', '/v1/chats/11111111-1111-1111-1111-111111111111/send'), true);
  assert.equal(quantizationBlocksRequest(true, 'POST', '/v1/sharing/start'), true);
  assert.equal(quantizationBlocksRequest(true, 'POST', '/v1/music/start'), true);
  assert.equal(quantizationBlocksRequest(true, 'POST', '/v1/music/generate'), true);
  assert.equal(quantizationBlocksRequest(true, 'POST', '/v1/editor/plan'), true);
  assert.equal(quantizationBlocksRequest(true, 'POST', '/v1/editor/apply'), true);
  assert.equal(quantizationBlocksRequest(true, 'POST', '/v1/pro/jobs'), true);
  assert.equal(quantizationBlocksRequest(true, 'POST', '/v1/model-library/quantize/cancel'), false);
  assert.equal(quantizationBlocksRequest(true, 'POST', '/v1/model-library/quantize'), false);
  assert.equal(quantizationBlocksRequest(false, 'POST', '/v1/music/start'), false);

  const server = readFileSync(resolve('src/server.ts'), 'utf8');
  const blockers = server.split('\n').filter(line => line.includes('model-library\\/(load|unload|engine|import-mlx)'));
  assert.equal(blockers.length, 2);
  for (const line of blockers) assert.equal(line.includes('quantize'), false);
  assert.match(server, /app\.post\('\/v1\/model-library\/quantize', async request => exclusive/);
  assert.match(server, /otherAiBlocksQuantize\(\{ chats: chats\.busy/);
  assert.match(server, /app\.post\('\/v1\/model-library\/import-mlx'[\s\S]*?library\.assertQuantizeIdle\(\)/);
  assert.match(server, /quantize\/estimate', async request => \{ if \(core\.vault\.locked\) throw new Error\('Cofre bloqueado'\)/);
  assert.match(server, /quantize\/cancel', async request => \{ if \(core\.vault\.locked\)/);
  assert.doesNotMatch(server, /quantize\/cancel', async request => exclusive/);

  const dir = mkdtempSync(join(tmpdir(), 'quantize-guard-'));
  const core = new Core(dir, resolve('.'));
  await core.init();
  await core.setup('senha-fixture-quantizar');
  class LeakyRuntime extends LocalRuntime {
    override inventory(): RuntimeModel[] { throw new Error('não abriu /home/ada/modelos/secreto.gguf'); }
  }
  const { app } = await createApp(core, 'quantize-guard', 'http://127.0.0.1:4317', new LeakyRuntime(dir, resolve('.')));
  const headers = { host: '127.0.0.1:4317', authorization: 'Bearer quantize-guard' };
  try {
    assert.equal((await app.inject({ method: 'GET', url: '/v1/model-library/quantize', headers, remoteAddress: '8.8.8.8' })).statusCode, 403);
    assert.equal((await app.inject({ method: 'POST', url: '/v1/model-library/quantize/cancel', headers, remoteAddress: '8.8.8.8', payload: {} })).statusCode, 403);
    const leaked = await app.inject({ method: 'POST', url: '/v1/model-library/quantize/estimate', headers, payload: { key: 'gguf:teste', preset: 'equilibrado' } });
    assert.equal(leaked.statusCode, 400);
    assert.match(leaked.json().error, /~\/…/);
    assert.doesNotMatch(leaked.json().error, /\/home\/ada/);
    core.vault.lock();
    const locked = await app.inject({ method: 'POST', url: '/v1/model-library/quantize/estimate', headers, payload: { key: 'gguf:teste', preset: 'equilibrado' } });
    assert.equal(locked.statusCode, 423);
  } finally {
    await app.close();
    await core.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('A conferência de RAM do MLX soma os pesos e ignora o tamanho da pasta', async () => {
  const { dir, models, tool } = layout();
  tool.mlxAvailable = true;
  const folder = join(models, 'modelo');
  mkdirSync(folder);
  writeFileSync(join(folder, 'config.json'), '{}\n');
  const weights = 8 * 1024 * 1024;
  writeFileSync(join(folder, 'weights.safetensors'), Buffer.alloc(64));
  const fd = openSync(join(folder, 'weights.safetensors'), 'r+');
  try { ftruncateSync(fd, weights); } finally { closeSync(fd); }
  const output = estimateOutputBytes(weights, 16, 4.5);
  const harness = mockLauncher();
  let reads = 0;
  const quantizer = new Quantizer(models, tool, {
    launch: harness.launch,
    memoryAvailable: () => {
      reads += 1;
      return reads === 1 ? 32 * GiB : output + GiB + 1024 * 1024;
    },
    diskFree: () => 32 * GiB,
    sandbox: false,
  });
  try {
    quantizer.start({ key: 'mlx:modelo', format: 'MLX', path: folder }, 'equilibrado');
    const failed = await until(quantizer, job => job?.state === 'failed');
    assert.match(failed?.error || '', /RAM livre insuficiente/);
    assert.equal(harness.calls.length, 0);
    assert.ok(reads >= 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('Com a quantização em andamento, chat, Minha API, música, Editor e Pro recebem 409', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'quantize-busy-'));
  const core = new Core(dir, resolve('.'));
  await core.init();
  await core.setup('senha-fixture-quantizar');
  const { app, library } = await createApp(core, 'quantize-busy');
  const headers = { host: '127.0.0.1:4317', authorization: 'Bearer quantize-busy' };
  library.quantizer.job = { id: 'job', key: 'gguf:teste', preset: 'equilibrado', state: 'quantizing', progress: 12, label: 'Quantizando', detail: 'GGUF Q4_K_M' };
  try {
    const blocked = [
      '/v1/chats/11111111-1111-1111-1111-111111111111/send',
      '/v1/sharing/start',
      '/v1/music/start',
      '/v1/music/generate',
      '/v1/editor/plan',
      '/v1/editor/apply',
      '/v1/pro/jobs',
    ];
    for (const url of blocked) {
      const response = await app.inject({ method: 'POST', url, headers, payload: {} });
      assert.equal(response.statusCode, 409, url);
      assert.match(response.json().error, /quantização/);
    }
    const cancel = await app.inject({ method: 'POST', url: '/v1/model-library/quantize/cancel', headers, payload: {} });
    assert.notEqual(cancel.statusCode, 409);
    const estimate = await app.inject({ method: 'POST', url: '/v1/model-library/quantize/estimate', headers, payload: { key: 'gguf:ausente', preset: 'equilibrado' } });
    assert.notEqual(estimate.statusCode, 409);
  } finally {
    library.quantizer.job = null;
    await app.close();
    await core.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('O limite global vale para a rota de quantização', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'quantize-limit-'));
  const core = new Core(dir, resolve('.'));
  await core.init();
  await core.setup('senha-fixture-quantizar');
  const { app } = await createApp(core, 'quantize-limit');
  const headers = { host: '127.0.0.1:4317', authorization: 'Bearer quantize-limit' };
  try {
    let limited = 0;
    for (let i = 0; i < 1201; i++) {
      const response = await app.inject({ method: 'GET', url: '/v1/model-library/quantize', headers });
      if (response.statusCode === 429) limited = i + 1;
    }
    assert.equal(limited, 1201);
  } finally {
    await app.close();
    await core.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
