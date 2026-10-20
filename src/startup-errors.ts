import { redactSensitive } from './redact-log.js';

export function startupMessage(error: unknown) {
  const err = error as { code?: string; message?: string };
  if (err?.code === 'EACCES' || err?.code === 'EPERM') return 'Não foi possível usar a pasta de dados. Confira as permissões deste usuário.';
  if (err?.code === 'ENOSPC') return 'Não há espaço em disco para abrir o LocalNeuron.';
  if (err?.code === 'EADDRINUSE') return 'A porta local está em uso por outro programa.';
  if (err?.code === 'ENOENT') return 'Um arquivo necessário do LocalNeuron não foi encontrado. Reinstale o aplicativo se ele não abrir.';
  const message = error instanceof Error ? error.message : '';
  if (!message) return 'O serviço local não iniciou.';
  return redactSensitive(message).slice(0, 500);
}
