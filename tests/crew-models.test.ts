import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '../src/catalog.js';
import { crewCandidates, crewRamCapGib, suggestCrewModels, type CrewCandidate, type CrewMachine } from '../src/crew-models.js';

const GiB = 1024 ** 3;

function machine(totalGib: number, extra: Partial<CrewMachine> = {}): CrewMachine {
  const total = totalGib * GiB;
  return {
    totalMemoryBytes: total,
    availableMemoryBytes: total,
    diskFreeBytes: 200 * GiB,
    platform: 'linux',
    architecture: 'x64',
    ...extra,
  };
}

function candidate(partial: Partial<CrewCandidate> & Pick<CrewCandidate, 'id' | 'parameters_b' | 'ram_gib'>): CrewCandidate {
  return {
    name: partial.id,
    computer_ram_gib: partial.computer_ram_gib ?? partial.ram_gib + 4,
    bytes: partial.bytes ?? 1_000_000_000,
    quantization: partial.quantization ?? 'Q4_K_M',
    categories: partial.categories ?? ['Conversa'],
    installed: partial.installed ?? false,
    local_key: partial.local_key ?? null,
    access: partial.access ?? 'public',
    support: partial.support ?? 'declared',
    ...partial,
  };
}

test('Os tetos de RAM seguem o início rápido', () => {
  assert.equal(crewRamCapGib(7 * GiB), 2);
  assert.equal(crewRamCapGib(8 * GiB), 4);
  assert.equal(crewRamCapGib(16 * GiB), 8);
  assert.equal(crewRamCapGib(32 * GiB), 12);
});

test('A sugestão prefere 7B a 14B e nunca escolhe 70B ou mais', () => {
  const models = [
    candidate({ id: 'pequeno', parameters_b: 2, ram_gib: 2 }),
    candidate({ id: 'medio', parameters_b: 9, ram_gib: 6 }),
    candidate({ id: 'faixa', parameters_b: 14, ram_gib: 8 }),
    candidate({ id: 'grande', parameters_b: 70, ram_gib: 8 }),
  ];
  const pick = suggestCrewModels(models, machine(32));
  assert.equal(pick.preferred?.id, 'faixa');
  assert.equal(pick.fallback?.id, 'pequeno');
  assert.ok((pick.preferred?.parameters_b ?? 0) <= 14);
  assert.equal(pick.advanced_for, 'coordinator');
  assert.equal(suggestCrewModels([candidate({ id: 'grande', parameters_b: 80, ram_gib: 8 })], machine(32)).preferred, null);
});

test('Sem faixa 7B–14B que caiba, cai para um modelo menor dentro do teto de RAM', () => {
  const models = [
    candidate({ id: 'sete', parameters_b: 7, ram_gib: 6, computer_ram_gib: 16 }),
    candidate({ id: 'mini', parameters_b: 2, ram_gib: 2, computer_ram_gib: 8 }),
  ];
  const pick = suggestCrewModels(models, machine(8));
  assert.equal(pick.ram_cap_gib, 4);
  assert.equal(pick.preferred, null);
  assert.equal(pick.fallback?.id, 'mini');
});

test('Prefere um modelo instalado da faixa e ignora plataforma sem motor', () => {
  const models = [
    candidate({ id: 'maior', parameters_b: 14, ram_gib: 10 }),
    candidate({ id: 'instalado', parameters_b: 8, ram_gib: 5, installed: true }),
  ];
  assert.equal(suggestCrewModels(models, machine(32)).preferred?.id, 'instalado');
  assert.equal(suggestCrewModels(models, machine(32, { platform: 'linux', architecture: 'arm64' })).preferred, null);
  assert.equal(suggestCrewModels([candidate({ id: 'fechado', parameters_b: 8, ram_gib: 5, access: 'restricted' })], machine(32)).preferred, null);
});

test('No catálogo real, um computador de 32 GiB recebe um modelo de 7B a 14B', () => {
  const models = crewCandidates(CATALOG, () => ({ access: 'public', support: { status: 'declared' } }));
  const pick = suggestCrewModels(models, machine(32));
  assert.ok(pick.preferred);
  assert.ok((pick.preferred?.parameters_b ?? 0) >= 7 && (pick.preferred?.parameters_b ?? 0) <= 14);
  assert.ok((pick.fallback?.parameters_b ?? 0) < 7);
  assert.ok(models.some(model => (model.parameters_b ?? 0) >= 70));
  assert.notEqual(pick.preferred?.id, models.find(model => (model.parameters_b ?? 0) >= 70)?.id);
});
