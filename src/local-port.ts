import { createRequire } from 'node:module';

const { legacyEnv } = createRequire(import.meta.url)('../../desktop/env.cjs') as {
  legacyEnv: (suffix: string, env?: NodeJS.ProcessEnv, warn?: (message: string) => void) => string | undefined;
};

export const BROWSER_PORT = 4317;
export const PORT_ATTEMPTS = 20;

export function portInUseMessage(port: number) {
  return `A porta ${port} está em uso por outro programa.`;
}

export function portFallbackMessage(preferred: number, actual: number) {
  return `A porta ${preferred} está em uso por outro programa. O LocalNeuron abriu na porta ${actual}.`;
}

function present(value: string | undefined): value is string {
  return typeof value === 'string' && value !== '';
}

export function preferredPort(env: NodeJS.ProcessEnv = process.env, fallback = BROWSER_PORT, warn: (message: string) => void = console.warn) {
  const raw = legacyEnv('PORT', env, warn);
  if (!present(raw)) return fallback;
  const name = present(env.LOCALNEURON_PORT) ? 'LOCALNEURON_PORT' : 'COLMEIA_PORT';
  if (!/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > 65535) throw new Error(`${name} inválida. Use um número de 1 a 65535.`);
  return Number(raw);
}

function isAddrInUse(error: unknown) {
  const err = error as { code?: string; cause?: { code?: string }; message?: string };
  return err?.code === 'EADDRINUSE' || err?.cause?.code === 'EADDRINUSE' || /EADDRINUSE/.test(err?.message ?? '');
}

export type BoundPort = {
  port: number;
  origin: string;
  preferred: number;
  fallback: boolean;
  message: string | null;
};

export async function listenWithFallback(preferred: number, listen: (port: number) => Promise<void>, attempts = PORT_ATTEMPTS): Promise<BoundPort> {
  if (!Number.isInteger(preferred) || preferred < 1 || preferred > 65535) throw new Error('COLMEIA_PORT inválida. Use um número de 1 a 65535.');
  for (let offset = 0; offset < attempts; offset++) {
    const port = preferred + offset;
    if (port > 65535) break;
    try {
      await listen(port);
      const fallback = port !== preferred;
      return { port, origin: `http://127.0.0.1:${port}`, preferred, fallback, message: fallback ? portFallbackMessage(preferred, port) : null };
    } catch (error) {
      if (!isAddrInUse(error)) throw error;
    }
  }
  throw new Error(portInUseMessage(preferred));
}
