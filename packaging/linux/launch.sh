#!/usr/bin/env bash
set -uo pipefail
root=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
fail() {
  printf 'LocalNeuron: %s\n' "$*" >&2
  if command -v zenity >/dev/null; then zenity --error --title=LocalNeuron --text="$*" 2>/dev/null || true
  elif command -v kdialog >/dev/null; then kdialog --error "$*" --title LocalNeuron 2>/dev/null || true
  elif command -v notify-send >/dev/null; then notify-send LocalNeuron "$*" 2>/dev/null || true; fi
  exit 1
}
cd -- "$root" || exit 1
[ "$(id -u)" != 0 ] || fail 'Abra com seu usuário normal, sem sudo.'
[ -x ./LocalNeuron ] && [ -s ./v8_context_snapshot.bin ] || fail 'Instalação incompleta. Execute novamente o instalador.'
sha256sum -c --status startup.sha256 || fail 'Arquivos de inicialização ausentes ou alterados. Reinstale o LocalNeuron.'
if command -v ldd >/dev/null; then
  dependencies=$(ldd ./LocalNeuron 2>&1)
  if [[ "$dependencies" == *'not found'* ]]; then fail "Bibliotecas do sistema ausentes. Instale-as pelo gerenciador de pacotes da sua distribuição:
$dependencies"; fi
fi
if [ "${1:-}" = --diagnose ]; then
  printf 'LocalNeuron: arquivos de inicialização íntegros\nSistema: %s\nArquitetura: %s\nSessão: %s\nWayland: %s · X11: %s\n' "$(uname -s)" "$(uname -m)" "${XDG_SESSION_TYPE:-não informada}" "${WAYLAND_DISPLAY:+disponível}" "${DISPLAY:+disponível}"
  printf 'Dependências Electron:\n%s\n' "${dependencies:-ldd indisponível}"
  exit 0
fi
[ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ] || fail 'Nenhuma sessão gráfica encontrada. Abra no seu desktop Linux.'
logs=${XDG_STATE_HOME:-"$HOME/.local/state"}/localneuron
mkdir -p -- "$logs" || fail 'Não foi possível criar a pasta de logs.'
# Preserve the latest failure without logging prompts or environment secrets here.
log="$logs/startup-$(date +%Y%m%d-%H%M%S)-$$.log"
(umask 077; : > "$log") || fail 'Não foi possível criar o log.'
./LocalNeuron "$@" >> "$log" 2>&1
status=$?
if [ "$status" != 0 ]; then
  fail "O LocalNeuron encerrou com código $status. Detalhes: $log
Se houver erro de sandbox, verifique o suporte a namespaces de usuário da distribuição. O instalador não desativa o sandbox."
fi
