import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import Module from 'node:module';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractDocument } from '../src/pro-documents.js';
import { installDesktopPdfCanvasGuard, isNativePdfCanvasRequest, pdfImportUsesElectronBinary } from '../src/pdf-canvas.js';
import { textPdf } from './pdf-fixture.js';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const compiledRoot = join(here, '..', '..');
const root = existsSync(join(compiledRoot, 'package.json')) ? compiledRoot : join(here, '..');
const sample = () => textPdf(['Aurora orcamento 120', 'Pagina dois']);

test('PDF devolve o texto das páginas e o Node continua com o canvas nativo', async () => {
  const loader = (Module as unknown as { _load: unknown })._load;
  assert.equal(installDesktopPdfCanvasGuard(), false);
  assert.equal((Module as unknown as { _load: unknown })._load, loader);
  const pages = await extractDocument('nota.pdf', sample());
  assert.deepEqual(pages.map(page => ({ location: page.location, text: page.text.trim() })), [
    { location: 'Página 1', text: 'Aurora orcamento 120' },
    { location: 'Página 2', text: 'Pagina dois' },
  ]);
  const canvas = require('@napi-rs/canvas') as { createCanvas: (width: number, height: number) => { getContext: (kind: string) => unknown } };
  assert.equal(typeof canvas.createCanvas(1, 1).getContext('2d'), 'object');
  await assert.rejects(extractDocument('ruim.pdf', Buffer.from('%PDF-1.4\nnao e um pdf')));
});

test('O canvas nativo do PDF só entra no binário do Electron', () => {
  assert.equal(pdfImportUsesElectronBinary(), false);
  assert.equal(pdfImportUsesElectronBinary({}), false);
  assert.equal(pdfImportUsesElectronBinary({ electron: '' }), false);
  assert.equal(pdfImportUsesElectronBinary({ electron: '45.0.0' }), true);
  assert.equal(isNativePdfCanvasRequest('@napi-rs/canvas'), true);
  assert.equal(isNativePdfCanvasRequest('@napi-rs/canvas/js-binding.js'), true);
  assert.equal(isNativePdfCanvasRequest('@napi-rs/canvas-linux-x64-gnu'), true);
  assert.equal(isNativePdfCanvasRequest('./skia.linux-x64-gnu.node'), true);
  assert.equal(isNativePdfCanvasRequest('/opt/app/node_modules/@napi-rs/canvas/js-binding.js'), true);
  assert.equal(isNativePdfCanvasRequest('@napi-rs/canvas/geometry.js'), false);
  assert.equal(isNativePdfCanvasRequest('pdfjs-dist/legacy/build/pdf.mjs'), false);
  assert.equal(isNativePdfCanvasRequest('canvas'), false);
  const sources = sourceFiles(join(root, 'src')).filter(file => readFileSync(file, 'utf8').includes('pdfjs-dist'));
  assert.deepEqual(sources.map(file => file.slice(root.length + 1).replaceAll('\\', '/')).sort(), ['src/pdf-canvas.ts']);
  const guard = readFileSync(join(root, 'src/pdf-canvas.ts'), 'utf8');
  const documents = readFileSync(join(root, 'src/pro-documents.ts'), 'utf8');
  const loader = guard.slice(guard.indexOf('export async function loadPdfjs'));
  assert.ok(loader.includes('installDesktopPdfCanvasGuard()'));
  assert.ok(loader.indexOf('installDesktopPdfCanvasGuard()') < loader.indexOf("import('pdfjs-dist/legacy/build/pdf.mjs')"));
  assert.match(documents, /loadPdfjs\(\)/);
  assert.doesNotMatch(documents, /pdfjs-dist/);
  assert.match(readFileSync(join(root, 'desktop/main.cjs'), 'utf8'), /ELECTRON_RUN_AS_NODE:\s*'1'/);
});

test('Importar um PDF no backend desktop não derruba o processo Electron', { timeout: 180_000 }, async () => {
  const electron = require('electron') as string;
  const childPath = join(root, 'tests/pdf-desktop-child.mjs');
  const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(electron, [childPath, sample().toString('base64')], {
      cwd: root,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
  const line = result.stdout.split(/\r?\n/).find(item => item.startsWith('PDF_DESKTOP_RESULT '));
  assert.ok(line, `o backend desktop encerrou com código ${result.code} sinal ${result.signal}\n${result.stderr}\n${result.stdout}`);
  const failure = `${result.stderr}\n${result.stdout}`;
  assert.equal(result.signal, null, failure);
  assert.equal(result.code, 0, failure);
  const report = JSON.parse(line.slice('PDF_DESKTOP_RESULT '.length)) as {
    pages: { location: string; text: string }[];
    invalid: string;
    nativeCode: string;
    electron: string;
    runAsNode: string;
    guard: boolean;
    matrixA: number;
  };
  assert.deepEqual(report.pages.map(page => ({ location: page.location, text: page.text.trim() })), [
    { location: 'Página 1', text: 'Aurora orcamento 120' },
    { location: 'Página 2', text: 'Pagina dois' },
  ]);
  assert.equal(typeof report.invalid, 'string');
  assert.ok(report.invalid.length > 0);
  assert.equal(report.nativeCode, 'ERR_ELECTRON_PDF_CANVAS');
  assert.equal(report.runAsNode, '1');
  assert.equal(report.guard, true);
  assert.match(report.electron, /^\d+\.\d+\.\d+/);
  assert.equal(report.matrixA, 1);
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}
