const GiB = 1024 ** 3;
/** Folga para o sistema antes de sugerir um modelo. */
export const STARTER_RESERVE_BYTES = Math.round(1.5 * GiB);
/** Margem de disco além do ficheiro do modelo. */
export const STARTER_DISK_MARGIN_BYTES = GiB;
/**
 * Teto de RAM estimada do modelo conforme a RAM total do computador.
 * Abaixo de 8 GiB: até 2. De 8 a menos de 16: até 4. De 16 a menos de 32: até 8. De 32 em diante: até 12.
 */
export const STARTER_RAM_CAPS_GIB = [
  { minTotalGib: 32, maxModelGib: 12 },
  { minTotalGib: 16, maxModelGib: 8 },
  { minTotalGib: 8, maxModelGib: 4 },
  { minTotalGib: 0, maxModelGib: 2 },
] as const;

export type StarterMachine = {
  totalMemoryBytes: number;
  availableMemoryBytes: number;
  diskFreeBytes: number;
  platform: string;
  architecture: string;
  installedCount: number;
};

export type StarterCandidate = {
  id: string;
  name: string;
  ram_gib: number;
  computer_ram_gib: number;
  bytes: number;
  quantization?: string;
  categories?: string[];
};

export type StarterPick = {
  id: string;
  name: string;
  ram_gib: number;
  computer_ram_gib: number;
  bytes: number;
  quantization: string;
};

export function starterPlatformReady(platform: string, architecture: string) {
  return (platform === 'darwin' && architecture === 'arm64')
    || (platform === 'win32' && architecture === 'x64')
    || (platform === 'linux' && architecture === 'x64');
}

export function starterRamCapGib(totalMemoryBytes: number) {
  const totalGib = totalMemoryBytes / GiB;
  return STARTER_RAM_CAPS_GIB.find((row) => totalGib >= row.minTotalGib)!.maxModelGib;
}

export function suggestStarterModel<T extends StarterCandidate>(
  models: T[],
  machine: StarterMachine,
  access: (model: T) => { access: string; support: { status: string } },
): StarterPick | null {
  if (machine.installedCount > 0 || !starterPlatformReady(machine.platform, machine.architecture)) return null;
  const budget = machine.availableMemoryBytes - STARTER_RESERVE_BYTES;
  if (budget <= 0) return null;
  const cap = starterRamCapGib(machine.totalMemoryBytes);
  const fits = models.filter((model) => {
    const row = access(model);
    return row.access === 'public'
      && row.support.status === 'declared'
      && model.categories?.includes('Conversa')
      && model.ram_gib <= cap
      && model.ram_gib * GiB <= budget
      && model.computer_ram_gib * GiB <= machine.totalMemoryBytes
      && model.bytes + STARTER_DISK_MARGIN_BYTES <= machine.diskFreeBytes;
  });
  fits.sort((a, b) => b.ram_gib - a.ram_gib
    || Number(/^Q4/i.test(b.quantization || '')) - Number(/^Q4/i.test(a.quantization || ''))
    || a.bytes - b.bytes
    || a.id.localeCompare(b.id));
  const pick = fits[0];
  if (!pick) return null;
  return { id: pick.id, name: pick.name, ram_gib: pick.ram_gib, computer_ram_gib: pick.computer_ram_gib, bytes: pick.bytes, quantization: pick.quantization || '' };
}
