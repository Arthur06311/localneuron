import Module, { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

type Geometry = { DOMMatrix?: unknown; DOMPoint?: unknown; DOMRect?: unknown };
type ElectronVersions = { electron?: string };
type Loader = (this: unknown, request: string, ...rest: unknown[]) => unknown;
type MutableModule = { _load: Loader };

const geometryGlobals = globalThis as unknown as Geometry;

// Mozilla PDF.js loads @napi-rs/canvas while evaluating its Node build.
// Inside the Electron binary that addon raises SIGTRAP (exit 133) on Linux,
// including the desktop backend spawned with ELECTRON_RUN_AS_NODE. The signal
// is not a JavaScript exception, so PDF.js cannot catch it. Text import only
// needs the pure-JS geometry helpers, so the native addon is refused first.
export function pdfImportUsesElectronBinary(versions?: ElectronVersions) {
  const runtime = versions ?? (process.versions as ElectronVersions);
  return typeof runtime.electron === 'string' && runtime.electron.length > 0;
}

export function isNativePdfCanvasRequest(request: string) {
  const name = request.replaceAll('\\', '/');
  if (name.includes('@napi-rs/canvas/geometry')) return false;
  if (name === '@napi-rs/canvas' || name.includes('@napi-rs/canvas/') || name.includes('@napi-rs/canvas-')) return true;
  const base = name.split('/').pop() || '';
  return /^skia\..+\.node$/.test(base);
}

let guarded = false;

export function installDesktopPdfCanvasGuard() {
  if (guarded || !pdfImportUsesElectronBinary()) return false;
  const loader = Module as unknown as MutableModule;
  const originalLoad = loader._load;
  loader._load = function (request, ...rest) {
    if (typeof request === 'string' && isNativePdfCanvasRequest(request)) {
      throw Object.assign(new Error('A renderização nativa de PDF não está disponível no aplicativo desktop.'), { code: 'ERR_ELECTRON_PDF_CANVAS' });
    }
    return originalLoad.call(this, request, ...rest);
  };
  guarded = true;
  installGeometryPolyfill();
  return true;
}

function installGeometryPolyfill() {
  if (geometryGlobals.DOMMatrix && geometryGlobals.DOMPoint && geometryGlobals.DOMRect) return;
  let geometry: Geometry;
  try {
    geometry = require('@napi-rs/canvas/geometry.js') as Geometry;
  } catch {
    return;
  }
  if (!geometryGlobals.DOMMatrix && geometry.DOMMatrix) geometryGlobals.DOMMatrix = geometry.DOMMatrix;
  if (!geometryGlobals.DOMPoint && geometry.DOMPoint) geometryGlobals.DOMPoint = geometry.DOMPoint;
  if (!geometryGlobals.DOMRect && geometry.DOMRect) geometryGlobals.DOMRect = geometry.DOMRect;
}

export async function loadPdfjs() {
  installDesktopPdfCanvasGuard();
  return import('pdfjs-dist/legacy/build/pdf.mjs');
}
