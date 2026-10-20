import { basename, isAbsolute } from 'node:path';

const SHELLS = new Set([
  'sh',
  'bash',
  'zsh',
  'fish',
  'dash',
  'ksh',
  'csh',
  'tcsh',
  'cmd',
  'cmd.exe',
  'powershell',
  'powershell.exe',
  'pwsh',
  'pwsh.exe',
  'wscript',
  'wscript.exe',
  'cscript',
  'cscript.exe',
  'mshta',
  'mshta.exe',
]);

export function assertLocalExecutable(command: string, args: readonly string[]) {
  if (typeof command !== 'string' || !isAbsolute(command) || command.length > 2048 || /[\0\r\n|&;<>$`]/.test(command)) {
    throw new Error('Use o caminho absoluto do executável, sem shell.');
  }
  if (SHELLS.has(basename(command).toLowerCase())) throw new Error('O comando local não pode ser um interpretador de shell.');
  if (!Array.isArray(args) || args.length > 30 || args.some(arg => typeof arg !== 'string' || arg.length > 2048 || arg.includes('\0'))) {
    throw new Error('Argumento de comando inválido.');
  }
}
