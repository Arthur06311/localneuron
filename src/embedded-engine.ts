import { LLAMA_ARCHITECTURES } from './engine-architectures.js';

export type HostPlatform = { platform: NodeJS.Platform; arch: string };
export type EmbeddedEngine = { runs: boolean; engine: 'llama.cpp' | 'MLX' | null; label: string };

const embeddingRepo = /(?:^|[-_/])(embed(?:ding)?s?|reranker)(?:[-_/]|$)/i;

export function llamaCppOnHost(host: HostPlatform) {
  return (host.platform === 'darwin' && host.arch === 'arm64')
    || (host.platform === 'win32' && host.arch === 'x64')
    || (host.platform === 'linux' && host.arch === 'x64');
}

export function embeddedEngine(model: { architecture?: string | null; repo?: string; file?: string; format?: string }, host: HostPlatform): EmbeddedEngine {
  const mlx = model.format === 'MLX' || /(?:^|[-_/])mlx(?:[-_/]|$)/i.test(`${model.repo || ''} ${model.file || ''}`);
  if (mlx) {
    const runs = host.platform === 'darwin' && host.arch === 'arm64';
    return { runs, engine: runs ? 'MLX' : null, label: runs ? 'Motor embutido · MLX' : '' };
  }
  const architecture = model.architecture || '';
  const runs = !embeddingRepo.test(model.repo || '') && llamaCppOnHost(host) && LLAMA_ARCHITECTURES.has(architecture);
  return { runs, engine: runs ? 'llama.cpp' : null, label: runs ? 'Motor embutido · llama.cpp' : '' };
}
