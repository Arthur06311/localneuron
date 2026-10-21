import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  closeSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  statfsSync,
} from 'node:fs';
import { availableParallelism } from 'node:os';
import { basename, dirname, extname, isAbsolute, join, relative } from 'node:path';
import { memoryStatus } from './model.js';

const GiB = 1024 ** 3;
/** Bits por peso medidos em Llama 3.1 8B, tabela do llama.cpp b10809. */
export const GGUF_BPW = {
  F32: 32,
  F16: 16.0005,
  BF16: 16,
  Q8_0: 8.5008,
  Q6_K: 6.5633,
  Q5_K_M: 5.7036,
  Q4_K_M: 4.8944,
  IQ4_XS: 4.4597,
} as const;

const FILE_TYPES: Record<number, { name: string; bpw: number; source: boolean }> = {
  0: { name: 'F32', bpw: GGUF_BPW.F32, source: true },
  1: { name: 'F16', bpw: GGUF_BPW.F16, source: true },
  7: { name: 'Q8_0', bpw: GGUF_BPW.Q8_0, source: true },
  2: { name: 'Q4_0', bpw: 4.5, source: false },
  10: { name: 'Q2_K', bpw: 3.1593, source: false },
  12: { name: 'Q3_K_M', bpw: 3.996, source: false },
  14: { name: 'Q4_K_S', bpw: 4.6672, source: false },
  15: { name: 'Q4_K_M', bpw: GGUF_BPW.Q4_K_M, source: false },
  17: { name: 'Q5_K_M', bpw: GGUF_BPW.Q5_K_M, source: false },
  18: { name: 'Q6_K', bpw: GGUF_BPW.Q6_K, source: false },
  28: { name: 'IQ4_XS', bpw: GGUF_BPW.IQ4_XS, source: false },
  30: { name: 'BF16', bpw: GGUF_BPW.BF16, source: true },
};

export const PRESET_IDS = ['equilibrado', 'menor', 'qualidade'] as const;
export type PresetId = (typeof PRESET_IDS)[number];
export type QuantFormat = 'GGUF' | 'MLX';

type Preset = {
  id: PresetId;
  label: string;
  gguf: { type: string; bpw: number; imatrix: boolean; detail: string };
  mlx: { bits: number; group: number; predicate: 'mixed_4_6' | null; bpw: number; detail: string };
};

export const PRESETS: Record<PresetId, Preset> = {
  equilibrado: {
    id: 'equilibrado',
    label: 'Equilibrado (recomendado)',
    gguf: { type: 'Q4_K_M', bpw: GGUF_BPW.Q4_K_M, imatrix: true, detail: 'GGUF Q4_K_M · imatrix' },
    mlx: { bits: 4, group: 64, predicate: null, bpw: 4.5, detail: 'MLX 4 bits · grupo 64' },
  },
  menor: {
    id: 'menor',
    label: 'Menor tamanho',
    gguf: { type: 'IQ4_XS', bpw: GGUF_BPW.IQ4_XS, imatrix: true, detail: 'GGUF IQ4_XS · imatrix' },
    mlx: { bits: 4, group: 128, predicate: null, bpw: 4.25, detail: 'MLX 4 bits · grupo 128' },
  },
  qualidade: {
    id: 'qualidade',
    label: 'Máxima qualidade',
    gguf: { type: 'Q6_K', bpw: GGUF_BPW.Q6_K, imatrix: false, detail: 'GGUF Q6_K' },
    mlx: { bits: 4, group: 64, predicate: 'mixed_4_6', bpw: 4.9, detail: 'MLX misto 4 e 6 bits' },
  },
};

export type QuantJobState = 'preparing' | 'imatrix' | 'quantizing' | 'done' | 'cancelled' | 'failed';
export type QuantJob = {
  id: string;
  key: string;
  preset: PresetId;
  state: QuantJobState;
  progress: number;
  label: string;
  detail: string;
  error?: string;
  output_bytes?: number;
  output_name?: string;
};

export type QuantEstimate = {
  eligible: boolean;
  preset: PresetId;
  label: string;
  detail: string;
  format: QuantFormat;
  source: string | null;
  output_bytes: number | null;
  ram_bytes: number | null;
  work_ram_bytes: number | null;
  disk_bytes: number | null;
  imatrix: boolean;
  note: string;
  error?: string;
};

export type QuantTarget = {
  key: string;
  format: QuantFormat;
  path: string;
  loaded?: boolean;
};

export type QuantizeTools = {
  quantize: string;
  imatrix: string;
  mlxPython: string;
  mlxAvailable: boolean;
  calibration: string;
};

type LaunchOptions = {
  cwd: string;
  env: NodeJS.ProcessEnv;
  shell: false;
  windowsHide: true;
  stdio: ['ignore', 'pipe', 'pipe'];
  signal: AbortSignal;
};

export type QuantProcess = {
  stdout: NodeJS.ReadableStream | null;
  stderr: NodeJS.ReadableStream | null;
  on(event: 'error', listener: (error: Error) => void): void;
  on(event: 'exit', listener: (code: number | null, signal: NodeJS.Signals | null) => void): void;
};

export type ProcessLauncher = (command: string, args: readonly string[], options: LaunchOptions) => QuantProcess;

const defaultLaunch: ProcessLauncher = (command, args, options) => spawn(command, args as string[], options) as ChildProcess;

const LABELS: Record<QuantJobState, string> = {
  preparing: 'Preparando a quantização',
  imatrix: 'Calculando a matriz de importância',
  quantizing: 'Quantizando',
  done: 'Quantização concluída',
  cancelled: 'Quantização cancelada',
  failed: 'A quantização não foi concluída',
};

const SCALAR = [1, 1, 2, 2, 4, 4, 4, 1, 0, 0, 8, 8, 8];

export function isPreset(value: string): value is PresetId {
  return (PRESET_IDS as readonly string[]).includes(value);
}

export function mapPreset(preset: PresetId, format: QuantFormat) {
  const plan = PRESETS[preset];
  const side = format === 'MLX' ? plan.mlx : plan.gguf;
  return {
    id: plan.id,
    label: plan.label,
    detail: side.detail,
    bpw: side.bpw,
    type: format === 'GGUF' ? plan.gguf.type : undefined,
    imatrix: format === 'GGUF' ? plan.gguf.imatrix : false,
    bits: format === 'MLX' ? plan.mlx.bits : undefined,
    group: format === 'MLX' ? plan.mlx.group : undefined,
    predicate: format === 'MLX' ? plan.mlx.predicate : undefined,
  };
}

/** O executável fica ao lado do llama-server no mesmo pacote oficial. */
export function toolBeside(serverBinary: string, name: 'llama-quantize' | 'llama-imatrix') {
  const match = /llama-server(\.exe)?$/i.exec(serverBinary);
  if (!match) throw new Error('O motor integrado não informa o executável do llama.cpp.');
  return serverBinary.slice(0, -match[0].length) + name + (match[1] ?? '');
}

export function estimateOutputBytes(sourceBytes: number, sourceBpw: number, targetBpw: number) {
  if (!Number.isFinite(sourceBytes) || sourceBytes <= 0 || !Number.isFinite(sourceBpw) || sourceBpw <= 0 || !Number.isFinite(targetBpw) || targetBpw <= 0) {
    throw new Error('Não há tamanho suficiente para estimar a quantização.');
  }
  return Math.max(1, Math.ceil((sourceBytes * targetBpw) / sourceBpw));
}

/** Mesma folga do carregamento integrado: GGUF × 1,25 + 1 GiB; MLX × 1 + 0,5 GiB. */
export function estimateUseRam(outputBytes: number, format: QuantFormat) {
  return Math.ceil(outputBytes * (format === 'MLX' ? 1 : 1.25) + (format === 'MLX' ? 0.5 : 1) * GiB);
}

export function mlxBitsPerWeight(bits: number, group: number) {
  if (bits >= 16) return bits;
  return bits + 32 / group;
}

export function modelsRoot(modelsDir: string) {
  const stated = lstatSync(modelsDir);
  if (stated.isSymbolicLink() || !stated.isDirectory()) throw new Error('A pasta de modelos do aplicativo não está disponível.');
  return realpathSync(modelsDir);
}

export function assertInsideModels(modelsDir: string, candidate: string) {
  if (!candidate || candidate.includes('\0')) throw new Error('Caminho de modelo inválido.');
  const root = modelsRoot(modelsDir);
  let resolved: string;
  try {
    resolved = realpathSync(candidate);
  } catch {
    throw new Error('O arquivo do modelo não está acessível.');
  }
  const rel = relative(root, resolved);
  if (!rel || rel.split(/[/\\]/).includes('..') || isAbsolute(rel)) {
    throw new Error('O modelo precisa estar dentro da pasta de modelos do aplicativo.');
  }
  return resolved;
}

export function destinationInside(modelsDir: string, filename: string) {
  const root = modelsRoot(modelsDir);
  const dir = join(root, 'quantized');
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const cleaned = filename.replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 96);
  const hidden = cleaned.startsWith('.') && !cleaned.startsWith('..');
  const body = (hidden ? cleaned.slice(1) : cleaned).replace(/^[.-]+/, '');
  const safe = hidden ? `.${body}` : body;
  if (!body || safe.includes('..') || safe === '.' || safe === '..') throw new Error('Nome de saída inválido.');
  const path = join(dir, safe);
  const rel = relative(root, path);
  if (!rel || rel.split(/[/\\]/).includes('..') || isAbsolute(rel)) throw new Error('A saída sairia da pasta de modelos.');
  return path;
}

export function readGgufFileType(file: string): number | null {
  const size = statSync(file).size;
  const limit = Math.min(size, 16 * 1024 * 1024);
  const buf = Buffer.alloc(limit);
  const fd = openSync(file, 'r');
  let read = 0;
  try {
    read = readSync(fd, buf, 0, limit, 0);
  } finally {
    closeSync(fd);
  }
  if (read < 24 || buf.readUInt32LE(0) !== 0x46554747) throw new Error('Este arquivo não é um GGUF.');
  const version = buf.readUInt32LE(4);
  if (version < 2 || version > 3) throw new Error('Versão de GGUF não suportada.');
  const kv = Number(buf.readBigUInt64LE(16));
  if (!Number.isSafeInteger(kv) || kv < 0 || kv > 1_000_000) return null;
  let offset = 24;
  const need = (bytes: number) => {
    if (offset + bytes > read) throw new Error('short');
  };
  const skip = (type: number): void => {
    if (type === 8) {
      need(8);
      const len = Number(buf.readBigUInt64LE(offset));
      offset += 8;
      if (!Number.isSafeInteger(len) || len < 0) throw new Error('short');
      need(len);
      offset += len;
      return;
    }
    if (type === 9) {
      need(12);
      const elem = buf.readUInt32LE(offset);
      offset += 4;
      const count = Number(buf.readBigUInt64LE(offset));
      offset += 8;
      if (!Number.isSafeInteger(count) || count < 0 || count > 100_000_000) throw new Error('short');
      if (elem === 8) {
        for (let i = 0; i < count; i++) skip(8);
        return;
      }
      const width = SCALAR[elem];
      if (!width) throw new Error('short');
      const bytes = count * width;
      if (!Number.isSafeInteger(bytes)) throw new Error('short');
      need(bytes);
      offset += bytes;
      return;
    }
    const width = SCALAR[type];
    if (!width) throw new Error('short');
    need(width);
    offset += width;
  };
  try {
    for (let i = 0; i < kv; i++) {
      need(8);
      const keyLen = Number(buf.readBigUInt64LE(offset));
      offset += 8;
      if (!Number.isSafeInteger(keyLen) || keyLen < 0 || keyLen > 1_000_000) return null;
      need(keyLen);
      const key = buf.toString('utf8', offset, offset + keyLen);
      offset += keyLen;
      need(4);
      const type = buf.readUInt32LE(offset);
      offset += 4;
      if (key === 'general.file_type' && (type === 4 || type === 5)) {
        need(4);
        return buf.readUInt32LE(offset);
      }
      skip(type);
    }
  } catch {
    return null;
  }
  return null;
}

function sourceFromName(filename: string) {
  const found = /(^|[^A-Z0-9])(F32|F16|BF16|Q8_0)(?=[^A-Z0-9]|$)/i.exec(filename);
  if (!found) return null;
  const name = found[2].toUpperCase();
  const known = Object.values(FILE_TYPES).find(entry => entry.name === name);
  return known ?? null;
}

function gib(bytes: number) {
  return (bytes / GiB).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' GiB';
}

function uniqueDestination(path: string) {
  if (!existsSync(path)) return path;
  const ext = extname(path);
  const stem = ext ? path.slice(0, -ext.length) : path;
  for (let i = 2; i < 1000; i++) {
    const next = `${stem}-${i}${ext}`;
    if (!existsSync(next)) return next;
  }
  throw new Error('Já existem muitas versões quantizadas deste modelo.');
}

function childEnv() {
  const env: NodeJS.ProcessEnv = {
    HF_HUB_OFFLINE: '1',
    TRANSFORMERS_OFFLINE: '1',
    HF_HUB_DISABLE_TELEMETRY: '1',
    PYTHONDONTWRITEBYTECODE: '1',
  };
  for (const key of ['PATH', 'HOME', 'USERPROFILE', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'TMPDIR', 'LANG', 'LC_ALL']) {
    if (process.env[key]) env[key] = process.env[key];
  }
  return env;
}

function threads() {
  return String(Math.max(1, Math.min(32, availableParallelism())));
}

export class Quantizer {
  job: QuantJob | null = null;
  private controller: AbortController | null = null;
  private finished: Promise<void> = Promise.resolve();
  private tail = '';

  constructor(
    private modelsDir: string,
    private tools: QuantizeTools,
    private hooks: {
      launch?: ProcessLauncher;
      memoryAvailable?: () => number;
      diskFree?: () => number;
      sandbox?: boolean;
    } = {},
  ) {}

  get running() {
    return Boolean(this.job && (this.job.state === 'preparing' || this.job.state === 'imatrix' || this.job.state === 'quantizing'));
  }

  view(): QuantJob | null {
    return this.job ? { ...this.job } : null;
  }

  private memory() {
    return this.hooks.memoryAvailable ? this.hooks.memoryAvailable() : memoryStatus().available_memory_bytes;
  }

  private disk() {
    if (this.hooks.diskFree) return this.hooks.diskFree();
    const stat = statfsSync(this.modelsDir);
    return stat.bavail * stat.bsize;
  }

  private sandbox() {
    if (this.hooks.sandbox !== undefined) return this.hooks.sandbox;
    return process.platform === 'darwin' && existsSync('/usr/bin/sandbox-exec');
  }

  estimate(target: QuantTarget, presetId: string): QuantEstimate {
    if (!isPreset(presetId)) throw new Error('Escolha um preset de quantização.');
    const preset = PRESETS[presetId];
    const blank = (detail: string): QuantEstimate => ({
      eligible: false,
      preset: preset.id,
      label: preset.label,
      detail,
      format: target.format,
      source: null,
      output_bytes: null,
      ram_bytes: null,
      work_ram_bytes: null,
      disk_bytes: null,
      imatrix: false,
      note: '',
    });
    try {
      const resolved = assertInsideModels(this.modelsDir, target.path);
      if (target.loaded) return { ...blank(target.format === 'MLX' ? preset.mlx.detail : preset.gguf.detail), error: 'Libere este modelo da memória antes de quantizar.' };
      if (target.format === 'MLX') return this.estimateMlx(resolved, preset);
      return this.estimateGguf(resolved, preset);
    } catch (error) {
      return { ...blank(target.format === 'MLX' ? preset.mlx.detail : preset.gguf.detail), error: (error as Error).message };
    }
  }

  private estimateGguf(resolved: string, preset: Preset): QuantEstimate {
    const name = basename(resolved);
    const detail = preset.gguf.detail;
    const base: QuantEstimate = { eligible: false, preset: preset.id, label: preset.label, detail, format: 'GGUF', source: null, output_bytes: null, ram_bytes: null, work_ram_bytes: null, disk_bytes: null, imatrix: false, note: '' };
    if (!/\.gguf$/i.test(name) || /^mmproj/i.test(name)) return { ...base, error: 'Escolha um modelo GGUF de texto. Projetores e outros arquivos ficam de fora.' };
    if (/-\d{5}-of-\d{5}\.gguf$/i.test(name)) return { ...base, error: 'Este GGUF está dividido em partes. A quantização desta versão aceita um único arquivo F16, BF16, F32 ou Q8_0.' };
    const stat = lstatSync(resolved);
    if (!stat.isFile() || stat.size <= 0) return { ...base, error: 'O arquivo GGUF está vazio ou não é um arquivo comum.' };
    const code = readGgufFileType(resolved);
    const typed = code === null ? sourceFromName(name) : FILE_TYPES[code] ?? { name: `tipo ${code}`, bpw: 0, source: false };
    if (!typed) return { ...base, error: 'Não foi possível identificar a quantização. Use um GGUF F16, BF16, F32 ou Q8_0.' };
    base.source = typed.name;
    if (!typed.source) return { ...base, error: `Este GGUF já está em ${typed.name}. Quantizar de novo perde qualidade. Use a versão F16, BF16, F32 ou Q8_0; o arquivo atual permanece.` };
    if (preset.gguf.bpw >= typed.bpw - 0.05) return { ...base, error: `O preset ${preset.label} não fica menor que a origem ${typed.name}. Escolha um preset mais compacto.` };
    if (!this.tools.quantize || !existsSync(this.tools.quantize)) {
      return { ...base, error: 'O quantizador llama-quantize não está neste pacote. Ele vem no mesmo arquivo do llama.cpp usado pelo motor, extraído na compilação por scripts/fetch-runtime.py.' };
    }
    const output = estimateOutputBytes(stat.size, typed.bpw, preset.gguf.bpw);
    const ram = estimateUseRam(output, 'GGUF');
    const quantRam = stat.size + GiB;
    const imatrixRam = Math.ceil(stat.size * 1.25 + GiB);
    const available = this.memory();
    const free = this.disk();
    const canImatrix = preset.gguf.imatrix && Boolean(this.tools.imatrix && existsSync(this.tools.imatrix) && this.tools.calibration && existsSync(this.tools.calibration));
    const imatrix = canImatrix && available >= imatrixRam;
    const work = imatrix ? Math.max(quantRam, imatrixRam) : quantRam;
    const disk = output + GiB;
    let note = `Estimativa pela proporção de bits por peso medida no Llama 3.1 8B. Origem ${typed.name}. O arquivo original permanece.`;
    if (typed.name === 'Q8_0') note += ' Q8_0 é quase sem perda e pode ser requantizado; o resultado fica abaixo de partir de 16 bits.';
    if (preset.gguf.imatrix && imatrix) note += ' A matriz de importância será calculada neste computador, com a amostra local, sem baixar dados.';
    if (preset.gguf.imatrix && !imatrix) note += this.tools.imatrix && existsSync(this.tools.imatrix) && this.tools.calibration && existsSync(this.tools.calibration)
      ? ' Sem matriz de importância: a RAM livre não comporta carregar o modelo para a calibração.'
      : ' Sem matriz de importância: o pacote não trouxe llama-imatrix ou a amostra local de calibração.';
    note += ` Durante o processo, cerca de ${gib(work)} de RAM.`;
    const shown = imatrix ? detail : detail.replace(' · imatrix', ' · sem imatrix');
    const error = available < work
      ? `RAM livre insuficiente para quantizar. O processo precisa de cerca de ${gib(work)}.`
      : free < disk
        ? 'Espaço em disco insuficiente para gravar o modelo quantizado e manter 1 GiB livre.'
        : undefined;
    return { ...base, eligible: !error, detail: shown, output_bytes: output, ram_bytes: ram, work_ram_bytes: work, disk_bytes: disk, imatrix, note, ...(error ? { error } : {}) };
  }

  private estimateMlx(resolved: string, preset: Preset): QuantEstimate {
    const detail = preset.mlx.detail;
    const base: QuantEstimate = { eligible: false, preset: preset.id, label: preset.label, detail, format: 'MLX', source: null, output_bytes: null, ram_bytes: null, work_ram_bytes: null, disk_bytes: null, imatrix: false, note: '' };
    const stat = lstatSync(resolved);
    if (!stat.isDirectory()) return { ...base, error: 'A quantização MLX precisa da pasta do modelo, com config.json e pesos.' };
    if (!this.tools.mlxAvailable || !this.tools.mlxPython || !existsSync(this.tools.mlxPython)) {
      return { ...base, error: 'A quantização MLX só existe no pacote para Mac com Apple Silicon, que já inclui o Python portátil. Nenhum Python do sistema é usado.' };
    }
    const configPath = join(resolved, 'config.json');
    let config: { quantization?: { bits?: unknown; group_size?: unknown }; quantization_config?: unknown };
    try {
      const configStat = lstatSync(configPath);
      if (!configStat.isFile() || configStat.isSymbolicLink() || configStat.size <= 0 || configStat.size > 2 * 1024 ** 2) throw new Error('config');
      config = JSON.parse(readFileSync(configPath, 'utf8'));
    } catch {
      return { ...base, error: 'A pasta MLX não tem uma config.json utilizável.' };
    }
    let bytes = 0;
    for (const entry of readdirSync(resolved, { withFileTypes: true })) {
      if (!entry.isFile() || entry.isSymbolicLink() || !entry.name.endsWith('.safetensors')) continue;
      bytes += lstatSync(join(resolved, entry.name)).size;
    }
    if (bytes <= 0) return { ...base, error: 'A pasta MLX não tem pesos .safetensors.' };
    const quant = config.quantization;
    const layered = Boolean(config.quantization_config) || (quant !== undefined && typeof quant?.bits !== 'number');
    if (layered) return { ...base, source: 'já quantizado', error: 'Esta pasta MLX já tem quantização por camada. Quantizar de novo perde qualidade. Use uma pasta em 16 bits.' };
    const bits = typeof quant?.bits === 'number' ? quant.bits : null;
    const group = typeof quant?.group_size === 'number' ? quant.group_size : 64;
    if (bits !== null && bits < 8) return { ...base, source: `${bits} bits`, error: `Esta pasta MLX já está quantizada (${bits} bits). Quantizar de novo perde qualidade. Use uma pasta em 16 bits.` };
    const sourceBpw = bits === null ? 16 : mlxBitsPerWeight(bits, group);
    const source = bits === null ? '16 bits' : `${bits} bits`;
    if (preset.mlx.bpw >= sourceBpw - 0.05) return { ...base, source, error: `O preset ${preset.label} não fica menor que a origem (${source}).` };
    const output = estimateOutputBytes(bytes, sourceBpw, preset.mlx.bpw);
    const ram = estimateUseRam(output, 'MLX');
    const work = bytes + output + GiB;
    const disk = output + GiB;
    const available = this.memory();
    const free = this.disk();
    const note = `Estimativa para ${detail}. A pasta original permanece. Durante o processo, cerca de ${gib(work)} de RAM. O conversor é o MLX LM 0.31.3 já incluído no pacote Mac, sem Python do sistema e sem rede.`;
    const error = available < work
      ? `RAM livre insuficiente para quantizar. O processo precisa de cerca de ${gib(work)}.`
      : free < disk
        ? 'Espaço em disco insuficiente para gravar a pasta quantizada e manter 1 GiB livre.'
        : undefined;
    return { ...base, eligible: !error, source, output_bytes: output, ram_bytes: ram, work_ram_bytes: work, disk_bytes: disk, note, ...(error ? { error } : {}) };
  }

  start(target: QuantTarget, presetId: string) {
    if (!isPreset(presetId)) throw new Error('Escolha um preset de quantização.');
    if (this.running) throw new Error('Já existe uma quantização em andamento.');
    const estimate = this.estimate(target, presetId);
    if (!estimate.eligible) throw new Error(estimate.error || 'Este modelo não pode ser quantizado.');
    const preset = PRESETS[presetId];
    const resolved = assertInsideModels(this.modelsDir, target.path);
    const id = randomBytes(4).toString('hex');
    const partialName = target.format === 'MLX' ? `.partial-${id}` : `.partial-${id}.gguf`;
    const partial = destinationInside(this.modelsDir, partialName);
    const finalName = target.format === 'MLX'
      ? `${stem(basename(resolved), '')}-${preset.mlx.predicate ? 'mixed-4-6' : preset.mlx.bits + 'bit' + (preset.mlx.group === 64 ? '' : '-g' + preset.mlx.group)}`
      : `${stem(basename(resolved), '.gguf')}-${preset.gguf.type}.gguf`;
    const finalPath = uniqueDestination(destinationInside(this.modelsDir, finalName));
    assertInsideModels(this.modelsDir, dirname(finalPath));
    this.controller = new AbortController();
    this.tail = '';
    this.job = {
      id,
      key: target.key,
      preset: preset.id,
      state: 'preparing',
      progress: 0,
      label: LABELS.preparing,
      detail: estimate.detail,
    };
    const signal = this.controller.signal;
    this.finished = this.execute({ target, preset, resolved, partial, finalPath, imatrix: estimate.imatrix, signal }).then(() => undefined, () => undefined);
    return this.view()!;
  }

  async cancel() {
    if (!this.running) return this.view();
    this.controller?.abort();
    await this.finished;
    return this.view();
  }

  clear() {
    if (this.running) throw new Error('Cancele a quantização antes de fechar o aviso.');
    this.job = null;
    return { ok: true as const };
  }

  private async execute(run: { target: QuantTarget; preset: Preset; resolved: string; partial: string; finalPath: string; imatrix: boolean; signal: AbortSignal }) {
    const imatrixPath = run.imatrix ? destinationInside(this.modelsDir, `.imatrix-${this.job!.id}.gguf`) : '';
    try {
      if (run.imatrix) {
        this.set('imatrix', 1);
        await this.track(this.launch(this.tools.imatrix, [
          '-m', run.resolved,
          '-f', this.tools.calibration,
          '-o', imatrixPath,
          '--no-ppl',
          '--ctx-size', '512',
          '--threads', threads(),
          '--gpu-layers', 'auto',
        ], dirname(this.tools.imatrix)));
        if (run.signal.aborted) throw Object.assign(new Error('cancel'), { cancelled: true });
        if (!existsSync(imatrixPath) || statSync(imatrixPath).size <= 0) throw new Error('A matriz de importância não foi gerada.');
      }
      this.set('quantizing', run.imatrix ? 42 : 8);
      if (run.target.format === 'MLX') await this.runMlx(run.resolved, run.partial, run.preset);
      else await this.runGguf(run.resolved, run.partial, run.preset, imatrixPath);
      if (!existsSync(run.partial)) throw new Error('O quantizador não gravou o arquivo.');
      const produced = lstatSync(run.partial);
      if (produced.isSymbolicLink() || (!produced.isFile() && !produced.isDirectory())) throw new Error('O quantizador não gravou um arquivo utilizável.');
      if (produced.isFile() && produced.size <= 0) throw new Error('O quantizador não gravou um arquivo utilizável.');
      chmodSync(run.partial, produced.isDirectory() ? 0o700 : 0o600);
      renameSync(run.partial, run.finalPath);
      const output = assertInsideModels(this.modelsDir, run.finalPath);
      const outputStat = statSync(output);
      const outputBytes = outputStat.isDirectory()
        ? readdirSync(output).reduce((sum, name) => sum + (name.endsWith('.safetensors') ? statSync(join(output, name)).size : 0), 0)
        : outputStat.size;
      if (outputBytes <= 0) throw new Error('O resultado quantizado não tem pesos.');
      if (!this.job) return;
      this.job.state = 'done';
      this.job.progress = 100;
      this.job.label = LABELS.done;
      this.job.output_bytes = outputBytes;
      this.job.output_name = basename(output);
      delete this.job.error;
    } catch (error) {
      if (!existsSync(run.partial)) rmSync(run.finalPath, { force: true, recursive: true });
      rmSync(run.partial, { force: true, recursive: true });
      if (!this.job) return;
      const cancelled = run.signal.aborted || (error as { cancelled?: boolean }).cancelled === true || (error as Error).name === 'AbortError';
      this.job.state = cancelled ? 'cancelled' : 'failed';
      this.job.label = LABELS[this.job.state];
      this.job.error = cancelled
        ? 'Quantização cancelada. O modelo original foi mantido.'
        : 'A quantização não foi concluída. ' + (error as Error).message.replace(this.tools.quantize, 'llama-quantize').slice(0, 500);
    } finally {
      if (imatrixPath) rmSync(imatrixPath, { force: true });
      this.controller = null;
    }
  }

  private set(state: QuantJobState, progress: number) {
    if (!this.job) return;
    this.job.state = state;
    this.job.label = LABELS[state];
    this.job.progress = progress;
  }

  private async runGguf(source: string, output: string, preset: Preset, imatrixPath: string) {
    const code = readGgufFileType(source);
    const named = (code === null ? sourceFromName(basename(source)) : FILE_TYPES[code])?.name;
    const args = [
      ...(named === 'Q8_0' ? ['--allow-requantize'] : []),
      ...(imatrixPath ? ['--imatrix', imatrixPath] : []),
      source,
      output,
      preset.gguf.type,
      threads(),
    ];
    await this.track(this.launch(this.tools.quantize, args, dirname(this.tools.quantize)));
  }

  private async runMlx(source: string, output: string, preset: Preset) {
    const args = ['-I', '-B', '-m', 'mlx_lm', 'convert', '--hf-path', source, '--mlx-path', output, '-q', '--q-bits', String(preset.mlx.bits), '--q-group-size', String(preset.mlx.group)];
    if (preset.mlx.predicate) args.push('--quant-predicate', preset.mlx.predicate);
    const sandboxed = this.sandbox();
    const command = sandboxed ? '/usr/bin/sandbox-exec' : this.tools.mlxPython;
    const argv = sandboxed ? ['-p', '(version 1)(allow default)(deny network-outbound)', this.tools.mlxPython, ...args] : args;
    await this.track(this.launch(command, argv, dirname(this.tools.mlxPython)));
  }

  private launch(command: string, args: string[], cwd: string) {
    if (!this.controller) throw new Error('Quantização sem cancelamento.');
    if (args.some(arg => arg.includes('\0'))) throw new Error('Argumento inválido.');
    const allowed = [this.tools.quantize, this.tools.imatrix, this.tools.mlxPython, '/usr/bin/sandbox-exec'].filter(Boolean);
    if (!allowed.includes(command)) throw new Error('Executável de quantização não autorizado.');
    return (this.hooks.launch ?? defaultLaunch)(command, args, {
      cwd,
      env: childEnv(),
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      signal: this.controller.signal,
    });
  }

  private track(child: QuantProcess) {
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        fn();
      };
      const take = (chunk: Buffer | string) => {
        const text = chunk.toString();
        this.tail = (this.tail + text).slice(-4000);
        this.noteProgress(text);
      };
      child.stdout?.on('data', take);
      child.stderr?.on('data', take);
      child.on('error', error => finish(() => reject(error)));
      child.on('exit', (code, signal) => finish(() => {
        if (this.controller?.signal.aborted) reject(Object.assign(new Error('cancel'), { cancelled: true }));
        else if (code === 0) resolve();
        else reject(new Error((this.tail || `código ${code ?? signal ?? 'desconhecido'}`).trim().slice(-400)));
      }));
    });
  }

  private noteProgress(text: string) {
    if (!this.job) return;
    if (/\[INFO\] Loading/i.test(text)) this.job.progress = Math.max(this.job.progress, 20);
    if (/\[INFO\] Quantizing/i.test(text)) this.job.progress = Math.max(this.job.progress, 60);
    const withImatrix = /· imatrix$/.test(this.job.detail);
    for (const match of text.matchAll(/\[\s*(\d+)\s*\/\s*(\d+)\s*\]/g)) {
      const current = Number(match[1]);
      const total = Number(match[2]);
      if (!total || current < 0) continue;
      const ratio = Math.min(1, current / total);
      const floor = this.job.state === 'imatrix' ? 1 : withImatrix ? 42 : 8;
      const span = this.job.state === 'imatrix' ? 38 : withImatrix ? 53 : 87;
      this.job.progress = Math.max(this.job.progress, Math.min(95, Math.round(floor + ratio * span)));
    }
  }
}

function stem(filename: string, extension: string) {
  const bare = extension ? filename.replace(new RegExp(extension + '$', 'i'), '') : filename;
  return bare.replace(/-(F16|BF16|F32|Q8_0)$/i, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[.-]+/, '').slice(0, 60) || 'modelo';
}
