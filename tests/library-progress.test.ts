import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Core } from '../src/core.js';
import { createApp } from '../src/server.js';
import { libraryRevision } from '../src/library-progress.js';
import { mergeLibraryProgress } from '../public/library-progress.js';

const base = { busy: false, media: { busy: false, jobs: [] as { model: string; file: number; state: string; error?: string }[] }, studio: null, profiles: [], catalogIds: ['qwen3-mini'], access: { checked_at: '2026-01-01', public: 1, restricted: 0, unsupported: 0, total: 1 } };

test('Revisão do catálogo ignora bytes baixados e muda com o estado', () => {
  const downloading = { ...base, jobs: [{ id: 'qwen3-mini', state: 'downloading', downloaded: 10, total: 100 }] };
  const sameBytes = libraryRevision(downloading);
  assert.equal(libraryRevision({ ...downloading, jobs: [{ id: 'qwen3-mini', state: 'downloading', downloaded: 80, total: 100 }] }), sameBytes);
  assert.notEqual(libraryRevision({ ...downloading, jobs: [{ id: 'qwen3-mini', state: 'verifying', downloaded: 100, total: 100 }] }), sameBytes);
  const media = { ...base, jobs: [], media: { busy: true, jobs: [{ model: 'sd', file: 0, state: 'downloading', downloaded: 1, total: 9 }] } };
  assert.equal(libraryRevision(media), libraryRevision({ ...media, media: { busy: true, jobs: [{ model: 'sd', file: 0, state: 'downloading', downloaded: 8, total: 9 }] } }));
  assert.notEqual(libraryRevision(media), libraryRevision({ ...media, media: { busy: true, jobs: [{ model: 'sd', file: 0, state: 'downloaded', downloaded: 9, total: 9 }] } }));
});

test('A interface só pede o catálogo de novo quando a revisão muda', () => {
  const status = { revision: 'abc', busy: false, disk_free_bytes: 1, available_memory_bytes: 2, total_memory_bytes: 3, catalog: [{ id: 'qwen3-mini', name: 'Qwen', job: { id: 'qwen3-mini', state: 'downloading', downloaded: 10, total: 100 } }], media_downloads: { busy: false, jobs: [] }, studio_download: null };
  const progress = { revision: 'abc', busy: false, disk_free_bytes: 9, available_memory_bytes: 8, total_memory_bytes: 3, jobs: [{ id: 'qwen3-mini', state: 'downloading', downloaded: 40, total: 100 }], media_downloads: { busy: false, jobs: [] }, studio_download: null };
  const merged = mergeLibraryProgress(status, progress);
  assert.equal(merged.refreshCatalog, false);
  assert.equal(merged.status.catalog[0].job.downloaded, 40);
  assert.equal(merged.status.disk_free_bytes, 9);
  assert.equal(merged.status.catalog[0].name, 'Qwen');
  assert.equal(mergeLibraryProgress(status, { ...progress, revision: 'nova' }).refreshCatalog, true);
});

test('O progresso tem limite por IP e o catálogo continua sem esse limite', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'library-progress-limit-'));
  const core = new Core(dir, resolve('.'));
  await core.init();
  await core.setup('senha-fixture-limite');
  const { app } = await createApp(core, 'progress-limit');
  const headers = { host: '127.0.0.1:4317', authorization: 'Bearer progress-limit' };
  try {
    let limited = 0;
    for (let i = 0; i < 130; i++) {
      const response = await app.inject({ method: 'GET', url: '/v1/model-library/progress', headers });
      if (response.statusCode === 429) {
        limited++;
        assert.equal(response.json().error, 'Muitas consultas num curto intervalo. Aguarde e tente novamente.');
        assert.ok(Number(response.headers['retry-after']) >= 1);
      } else assert.equal(response.statusCode, 200);
    }
    assert.equal(limited, 10);
    assert.equal((await app.inject({ method: 'GET', url: '/v1/model-library', headers })).statusCode, 200);
  } finally {
    await app.close();
    await core.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Catálogo usa ETag e o progresso cabe num ciclo curto', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'library-progress-'));
  const core = new Core(dir, resolve('.'));
  await core.init();
  await core.setup('senha-fixture-progresso');
  const { app } = await createApp(core, 'progress-fixture');
  const headers = { host: '127.0.0.1:4317', authorization: 'Bearer progress-fixture' };
  try {
    assert.equal((await app.inject({ method: 'GET', url: '/v1/model-library/progress', headers: { host: headers.host } })).statusCode, 401);
    assert.equal((await app.inject({ method: 'GET', url: '/library-progress.js', headers: { host: headers.host } })).statusCode, 200);
    const catalog = await app.inject({ method: 'GET', url: '/v1/model-library', headers });
    const progress = await app.inject({ method: 'GET', url: '/v1/model-library/progress', headers });
    assert.equal(catalog.statusCode, 200);
    assert.equal(progress.statusCode, 200);
    const catalogBytes = Buffer.byteLength(catalog.body);
    const progressBytes = Buffer.byteLength(progress.body);
    const catalogJson = catalog.json();
    const progressJson = progress.json();
    assert.ok(catalogBytes > progressBytes * 20, `catálogo ${catalogBytes} B deveria ser bem maior que o progresso ${progressBytes} B`);
    assert.equal(progressJson.revision, catalogJson.revision);
    assert.equal(progressJson.catalog, undefined);
    assert.equal(progressJson.media_catalog, undefined);
    assert.equal(progressJson.media_profiles, undefined);
    assert.equal(progressJson.installed, undefined);
    assert.ok(Array.isArray(catalogJson.catalog) && catalogJson.catalog.length > 0);
    assert.ok(Array.isArray(catalogJson.media_catalog) && catalogJson.media_catalog.length > 0);
    const etag = catalog.headers.etag;
    assert.match(String(etag), /^"[A-Za-z0-9_-]+"$/);
    const cached = await app.inject({ method: 'GET', url: '/v1/model-library', headers: { ...headers, 'if-none-match': etag } });
    assert.equal(cached.statusCode, 304);
    assert.equal(Buffer.byteLength(cached.body), 0);
    const changed = await app.inject({ method: 'GET', url: '/v1/model-library', headers: { ...headers, 'if-none-match': '"outro"' } });
    assert.equal(changed.statusCode, 200);
    assert.equal(changed.json().revision, catalogJson.revision);
    assert.ok(Buffer.byteLength(changed.body) > progressBytes * 20);
    const source = readFileSync(resolve('public/app.js'), 'utf8');
    assert.match(source, /api\('\/model-library\/progress'\)/);
    assert.match(source, /if-none-match/);
    await app.inject({ method: 'POST', url: '/v1/lock', headers, payload: {} });
    assert.equal((await app.inject({ method: 'GET', url: '/v1/model-library/progress', headers })).statusCode, 423);
    assert.equal((await app.inject({ method: 'GET', url: '/v1/model-library', headers })).statusCode, 423);
  } finally {
    await app.close();
    await core.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
