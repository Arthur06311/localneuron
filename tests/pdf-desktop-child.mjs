import { createRequire } from 'node:module';
import { extractDocument } from '../dist/src/pro-documents.js';
import { pdfImportUsesElectronBinary } from '../dist/src/pdf-canvas.js';

const require = createRequire(import.meta.url);

try {
  const data = Buffer.from(process.argv[2] || '', 'base64');
  const pages = await extractDocument('nota.pdf', data);
  let invalid = null;
  try {
    await extractDocument('ruim.pdf', Buffer.from('%PDF-1.4\nnao e um pdf'));
  } catch (error) {
    invalid = error instanceof Error ? error.name : 'throw';
  }
  let nativeCode = null;
  try {
    require('@napi-rs/canvas');
  } catch (error) {
    nativeCode = error && error.code ? error.code : 'throw';
  }
  const matrix = new globalThis.DOMMatrix();
  console.log('PDF_DESKTOP_RESULT ' + JSON.stringify({
    pages,
    invalid,
    nativeCode,
    electron: process.versions.electron,
    runAsNode: process.env.ELECTRON_RUN_AS_NODE,
    guard: pdfImportUsesElectronBinary(),
    matrixA: matrix.a,
  }));
} catch (error) {
  console.log('PDF_DESKTOP_RESULT ' + JSON.stringify({ failed: error instanceof Error ? error.stack : String(error) }));
  process.exitCode = 1;
}
