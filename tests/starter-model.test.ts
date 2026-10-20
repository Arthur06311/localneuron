import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '../src/catalog.js';
import { modelSupport } from '../src/catalog-access.js';
import { starterRamCapGib, starterPlatformReady, suggestStarterModel, STARTER_RESERVE_BYTES, type StarterCandidate, type StarterMachine } from '../src/starter-model.js';

const GiB = 1024 ** 3;
const open = { access: 'public', support: { status: 'declared' } };
const machine = (patch: Partial<StarterMachine> = {}): StarterMachine => ({
  totalMemoryBytes: 16 * GiB,
  availableMemoryBytes: 12 * GiB,
  diskFreeBytes: 40 * GiB,
  platform: 'linux',
  architecture: 'x64',
  installedCount: 0,
  ...patch,
});
const model = (patch: Partial<StarterCandidate> = {}): StarterCandidate => ({
  id: 'pequeno',
  name: 'Pequeno',
  ram_gib: 4,
  computer_ram_gib: 8,
  bytes: 2 * GiB,
  quantization: 'Q4_K_M',
  categories: ['Conversa'],
  ...patch,
});

test('Limiares de RAM e plataformas do início rápido', () => {
  assert.equal(starterRamCapGib(7.9 * GiB), 2);
  assert.equal(starterRamCapGib(8 * GiB), 4);
  assert.equal(starterRamCapGib(15.9 * GiB), 4);
  assert.equal(starterRamCapGib(16 * GiB), 8);
  assert.equal(starterRamCapGib(31 * GiB), 8);
  assert.equal(starterRamCapGib(32 * GiB), 12);
  assert.equal(starterPlatformReady('darwin', 'arm64'), true);
  assert.equal(starterPlatformReady('win32', 'x64'), true);
  assert.equal(starterPlatformReady('linux', 'x64'), true);
  assert.equal(starterPlatformReady('linux', 'arm64'), false);
  assert.equal(starterPlatformReady('darwin', 'x64'), false);
  assert.equal(starterPlatformReady('win32', 'arm64'), false);
});

test('Sugere um único modelo que cabe na RAM, no disco e na plataforma', () => {
  const models = [
    model({ id: 'grande', name: 'Grande', ram_gib: 9, computer_ram_gib: 16 }),
    model({ id: 'q8', name: 'Q8', ram_gib: 4, quantization: 'Q8_0', bytes: GiB }),
    model({ id: 'q4', name: 'Q4', ram_gib: 4, quantization: 'Q4_K_M', bytes: 3 * GiB }),
    model({ id: 'codigo', name: 'Código', ram_gib: 4, categories: ['Código'] }),
    model({ id: 'mini', name: 'Mini', ram_gib: 2, computer_ram_gib: 8, bytes: GiB }),
  ];
  const pick = suggestStarterModel(models, machine(), () => open);
  assert.deepEqual(pick && { id: pick.id, quantization: pick.quantization }, { id: 'q4', quantization: 'Q4_K_M' });
  assert.equal(suggestStarterModel(models, machine({ installedCount: 1 }), () => open), null);
  assert.equal(suggestStarterModel(models, machine({ platform: 'linux', architecture: 'arm64' }), () => open), null);
  assert.equal(suggestStarterModel(models, machine({ availableMemoryBytes: STARTER_RESERVE_BYTES }), () => open), null);
  assert.equal(suggestStarterModel(models, machine({ totalMemoryBytes: 8 * GiB, availableMemoryBytes: 4 * GiB }), () => open)?.id, 'mini');
  assert.equal(suggestStarterModel(models, machine({ diskFreeBytes: GiB }), () => open), null);
  const blocked = suggestStarterModel(models, machine(), (item) => item.id === 'q4' || item.id === 'q8' || item.id === 'grande' ? { access: 'restricted', support: { status: 'declared' } } : open);
  assert.equal(blocked?.id, 'mini');
  const unsupported = suggestStarterModel(models, machine(), (item) => item.id === 'q4' ? { access: 'public', support: { status: 'unsupported' } } : open);
  assert.equal(unsupported?.id, 'q8');
});

test('O catálogo real devolve no máximo um modelo dentro do limiar', () => {
  const total = 16 * GiB;
  const pick = suggestStarterModel(CATALOG, machine({ totalMemoryBytes: total, availableMemoryBytes: 14 * GiB, diskFreeBytes: 80 * GiB }), (item) => ({
    access: item.requires_auth ? 'restricted' : 'public',
    support: modelSupport(item),
  }));
  assert.ok(pick);
  assert.equal(CATALOG.filter((item) => item.id === pick!.id).length, 1);
  assert.ok(pick!.ram_gib <= 8);
  assert.ok(pick!.computer_ram_gib * GiB <= total);
  assert.equal(suggestStarterModel(CATALOG, machine({ platform: 'darwin', architecture: 'x64' }), () => open), null);
});
