import { statfsSync } from 'node:fs';
import { totalmem } from 'node:os';
import { memoryStatus } from './model.js';
import { ADVANCED_PARAMETERS, LOCAL_PARAMETER_MAX, LOCAL_PARAMETER_MIN } from './crew-policy.js';

const GiB = 1024 ** 3;

/** Mesmos limiares de RAM do modelo de início rápido: até 2, 4, 8 ou 12 GiB. */
export const CREW_RAM_CAPS_GIB = [
  { minTotalGib: 32, maxModelGib: 12 },
  { minTotalGib: 16, maxModelGib: 8 },
  { minTotalGib: 8, maxModelGib: 4 },
  { minTotalGib: 0, maxModelGib: 2 },
] as const;

export const CREW_RESERVE_BYTES = Math.round(1.5 * GiB);
export const CREW_DISK_MARGIN_BYTES = GiB;

export type CrewMachine = {
  totalMemoryBytes: number;
  availableMemoryBytes: number;
  diskFreeBytes: number;
  platform: string;
  architecture: string;
};

export type CrewCandidate = {
  id: string;
  name: string;
  parameters_b: number | null;
  ram_gib: number;
  computer_ram_gib: number;
  bytes: number;
  quantization: string;
  categories: string[];
  installed: boolean;
  local_key: string | null;
  access: string;
  support: string;
};

export type CrewPick = {
  id: string;
  name: string;
  parameters_b: number | null;
  ram_gib: number;
  quantization: string;
  installed: boolean;
};

export type CrewSuggestion = {
  band: '7B-14B';
  basis: 'ram';
  ram_cap_gib: number;
  preferred: CrewPick | null;
  fallback: CrewPick | null;
  advanced_min_parameters_b: number;
  advanced_for: 'coordinator';
  advanced_channels: readonly ['exo', 'openai', 'anthropic', 'xai'];
  note: string;
};

const NOTE = 'Por predefinição, a equipa usa um modelo local de 7B a 14B que caiba na RAM. Modelos de 70B ou mais, o EXO, outro computador, Anthropic e xAI são uma opção avançada e só podem ficar no coordenador.';

export function crewPlatformReady(platform: string, architecture: string) {
  return (platform === 'darwin' && architecture === 'arm64')
    || (platform === 'win32' && architecture === 'x64')
    || (platform === 'linux' && architecture === 'x64');
}

export function crewRamCapGib(totalMemoryBytes: number) {
  const totalGib = totalMemoryBytes / GiB;
  return CREW_RAM_CAPS_GIB.find(row => totalGib >= row.minTotalGib)!.maxModelGib;
}

export function crewMachine(directory: string): CrewMachine {
  const disk = statfsSync(directory);
  const memory = memoryStatus();
  return {
    totalMemoryBytes: totalmem(),
    availableMemoryBytes: memory.available_memory_bytes,
    diskFreeBytes: disk.bavail * disk.bsize,
    platform: process.platform,
    architecture: process.arch,
  };
}

function fits(model: CrewCandidate, machine: CrewMachine, cap: number) {
  const budget = machine.availableMemoryBytes - CREW_RESERVE_BYTES;
  return model.access === 'public'
    && model.support === 'declared'
    && model.categories.includes('Conversa')
    && (model.parameters_b === null || model.parameters_b < ADVANCED_PARAMETERS)
    && model.ram_gib <= cap
    && model.ram_gib * GiB <= budget
    && model.computer_ram_gib * GiB <= machine.totalMemoryBytes
    && model.bytes + CREW_DISK_MARGIN_BYTES <= machine.diskFreeBytes;
}

function sortPicks(models: CrewCandidate[]) {
  return [...models].sort((a, b) => Number(b.installed) - Number(a.installed)
    || b.ram_gib - a.ram_gib
    || Number(/^Q4/i.test(b.quantization)) - Number(/^Q4/i.test(a.quantization))
    || a.bytes - b.bytes
    || a.id.localeCompare(b.id));
}

function toPick(model: CrewCandidate): CrewPick {
  return { id: model.id, name: model.name, parameters_b: model.parameters_b, ram_gib: model.ram_gib, quantization: model.quantization, installed: model.installed };
}

export function suggestCrewModels(models: CrewCandidate[], machine: CrewMachine): CrewSuggestion {
  const cap = crewRamCapGib(machine.totalMemoryBytes);
  const base = {
    band: '7B-14B' as const,
    basis: 'ram' as const,
    ram_cap_gib: cap,
    advanced_min_parameters_b: ADVANCED_PARAMETERS,
    advanced_for: 'coordinator' as const,
    advanced_channels: ['exo', 'openai', 'anthropic', 'xai'] as const,
    note: NOTE,
  };
  if (!crewPlatformReady(machine.platform, machine.architecture)) return { ...base, preferred: null, fallback: null };
  const eligible = models.filter(model => fits(model, machine, cap));
  const preferred = sortPicks(eligible.filter(model => model.parameters_b !== null && model.parameters_b >= LOCAL_PARAMETER_MIN && model.parameters_b <= LOCAL_PARAMETER_MAX))[0];
  const fallback = sortPicks(eligible.filter(model => model.parameters_b === null || model.parameters_b < LOCAL_PARAMETER_MIN))[0];
  return { ...base, preferred: preferred ? toPick(preferred) : null, fallback: fallback ? toPick(fallback) : null };
}

type CatalogLike = {
  id: string;
  name: string;
  parameters_b?: number;
  ram_gib: number;
  computer_ram_gib: number;
  bytes: number;
  quantization?: string;
  categories?: string[];
  file: string;
};

export function crewCandidates<T extends CatalogLike>(
  models: T[],
  access: (model: T) => { access: string; support: { status: string } },
  installed: Array<{ path: string; key: string }> = [],
): CrewCandidate[] {
  return models.map(model => {
    const row = access(model);
    const hit = model.file ? installed.find(entry => entry.path.endsWith(`/${model.file}`) || entry.path.endsWith(`\\${model.file}`)) : undefined;
    return {
      id: model.id,
      name: model.name,
      parameters_b: typeof model.parameters_b === 'number' ? model.parameters_b : null,
      ram_gib: model.ram_gib,
      computer_ram_gib: model.computer_ram_gib,
      bytes: model.bytes,
      quantization: model.quantization || '',
      categories: model.categories || [],
      installed: Boolean(hit),
      local_key: hit?.key ?? null,
      access: row.access,
      support: row.support.status,
    };
  });
}
