import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ServerMode, memoryByNode, participationPlan, readMaster, serverModeMap, workerEligibility } from '../src/server-mode.js';

const mac = { platform: 'darwin', arch: 'arm64', release: '25.2.0' };
const linux = { platform: 'linux', arch: 'x64', release: '6.8.0' };
const windows = { platform: 'win32', arch: 'x64', release: '10.0.26100' };

const state = {
  topology: {
    nodes: ['mac-sala', 'linux-cpu'],
    connections: [
      { from: 'mac-sala', to: 'linux-cpu', type: 'socket' },
      { source: 'mac-sala', target: 'linux-cpu', connection_type: 'rdma' },
    ],
  },
  node_identities: { 'mac-sala': { friendly_name: 'Mac da sala' }, 'linux-cpu': { friendly_name: 'Linux da bancada' } },
  node_memory: {
    'mac-sala': { ram_total: { in_bytes: 68_719_476_736 }, ram_available: { in_bytes: 40_000_000_000 } },
    'linux-cpu': { ram_total: { in_bytes: 34_359_738_368 }, ram_available: { in_bytes: 20_000_000_000 } },
  },
};

test('Contribuir só libera Mac Apple Silicon recente e Linux experimental', () => {
  assert.deepEqual(workerEligibility(mac), { allowed: true, experimental: false, reason: 'Mac Apple Silicon com macOS 26.2 ou superior.' });
  assert.equal(workerEligibility({ platform: 'darwin', arch: 'arm64', release: '25.1.0' }).allowed, false);
  assert.equal(workerEligibility({ platform: 'darwin', arch: 'x64', release: '25.2.0' }).allowed, false);
  assert.equal(workerEligibility(linux).experimental, true);
  assert.equal(workerEligibility(linux).allowed, true);
  assert.equal(workerEligibility(windows).allowed, false);
});

test('O plano fica desligado e o gerenciar pede preferência de master sem RDMA', () => {
  assert.deepEqual(participationPlan('off').args, []);
  assert.equal(participationPlan('off').startsNode, false);
  assert.match(participationPlan('contribute').note, /namespace não é senha/);
  assert.deepEqual(participationPlan('manage', true), {
    role: 'manage',
    args: ['--force-master', '--no-worker'],
    startsNode: true,
    noWorker: true,
    note: 'O EXO pode eleger outro master. --force-master só dá preferência.',
    transport: 'TCP',
  });
  assert.equal(participationPlan('use').startsNode, false);
  const source = readFileSync(new URL('../../src/server-mode.ts', import.meta.url), 'utf8');
  assert.match(source, /TODO\(fase RDMA\)/);
  assert.match(source, /caminho desta fase é TCP/);
});

test('O mapa mostra RAM e linha grossa só para Thunderbolt ou RDMA', () => {
  const map = serverModeMap(state, readMaster({ node_id: 'linux-cpu', master_node_id: 'mac-sala' }));
  assert.equal(map.transport, 'TCP');
  assert.equal(map.master, 'mac-sala');
  assert.equal(map.nodes[0].name, 'Mac da sala');
  assert.equal(map.nodes[0].total, 68_719_476_736);
  assert.equal(map.nodes[0].master, true);
  assert.equal(map.links.length, 1);
  assert.equal(map.links[0].kind, 'rdma');
  assert.equal(map.links[0].label, 'Thunderbolt/RDMA');
  const tcp = serverModeMap({ topology: { nodes: ['a', 'b'], connections: { a: { b: 'socket' } } }, node_memory: {} }, null);
  assert.equal(tcp.links[0].kind, 'tcp');
});

test('Desligado não consulta o EXO e IP público é recusado', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'server-mode-'));
  let calls = 0;
  const fetcher = (async () => {
    calls += 1;
    return new Response('{}', { status: 200 });
  }) as typeof fetch;
  const mode = new ServerMode(dir, fetcher, windows);
  try {
    assert.equal(mode.snapshot().role, 'off');
    assert.equal(mode.snapshot().enabled, false);
    await assert.rejects(() => mode.map(), /desligado/);
    assert.equal(calls, 0);
    assert.throws(() => mode.setRole({ role: 'use', endpoint: 'http://1.1.1.1:52415' }), /privado/);
    assert.throws(() => mode.setRole({ role: 'contribute' }), /macOS 26\.2/);
    const chosen = mode.setRole({ role: 'use', endpoint: 'http://192.168.1.20:52415' });
    assert.equal(chosen.role, 'use');
    assert.equal(chosen.endpoint, 'http://192.168.1.20:52415');
    assert.equal(mode.disable().role, 'off');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('A prévia devolve a memória de cada computador escolhido', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'server-mode-preview-'));
  const fetcher = (async (url: string) => {
    if (String(url).endsWith('/state')) return Response.json(state);
    if (String(url).endsWith('/node_id')) return Response.json({ master_node_id: 'mac-sala' });
    assert.match(String(url), /\/instance\/previews\?/);
    assert.match(String(url), /model_id=llama-70b/);
    assert.match(String(url), /node_ids=mac-sala/);
    return Response.json({
      previews: [{
        model_id: 'llama-70b',
        memory_delta_by_node: { 'mac-sala': 21_000_000_000, 'linux-cpu': 19_000_000_000 },
        instance: { shard_assignments: { model_id: 'llama-70b', node_to_runner: { 'mac-sala': 'r1', 'linux-cpu': 'r2' } } },
      }],
    });
  }) as typeof fetch;
  const mode = new ServerMode(dir, fetcher, mac);
  try {
    mode.setRole({ role: 'manage', no_worker: true });
    const discovered = await mode.map();
    assert.equal(discovered.map?.nodes.length, 2);
    assert.equal(discovered.plan.args.join(' '), '--force-master --no-worker');
    const preview = await mode.preview({ model_id: 'llama-70b', nodes: ['linux-cpu', 'mac-sala'] });
    assert.deepEqual(preview.preview, [
      { id: 'linux-cpu', bytes: 19_000_000_000 },
      { id: 'mac-sala', bytes: 21_000_000_000 },
    ]);
    assert.throws(() => memoryByNode({ previews: [] }, 'llama-70b', ['mac-sala']), /não mostrou uma divisão/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
