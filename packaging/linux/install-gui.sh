#!/usr/bin/env bash
# Graphical entry point for the offline ZIP installer.
set -uo pipefail
folder=$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
installer="$folder/LocalNeuron-Linux-@ARCH@.run"
self="$folder/install-gui.sh"
mode=${1:---gui}
log_dir=${XDG_STATE_HOME:-"$HOME/.local/state"}/localneuron
mkdir -p -- "$log_dir" || exit 1
log=$(umask 077; mktemp "$log_dir/install-XXXXXXXX.log") || exit 1
worker=''
cleanup() {
  if [ -n "$worker" ]; then
    kill -TERM -- "-$worker" 2>/dev/null || kill -TERM "$worker" 2>/dev/null || true
    wait "$worker" 2>/dev/null || true
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
error() {
  printf 'LocalNeuron: %s\nDetalhes: %s\n' "$1" "$log" >&2
  if command -v zenity >/dev/null && [ "$mode" != --terminal ]; then
    zenity --error --no-markup --title='Instalar LocalNeuron' --width=480 --text="$1
Detalhes: $log" 2>/dev/null || true
  elif command -v notify-send >/dev/null; then
    notify-send 'Instalar LocalNeuron' "$1 · $log" 2>/dev/null || true
  fi
}
[ -f "$installer" ] || { error 'Extraia a pasta inteira antes de instalar. O pacote do aplicativo não foi encontrado.'; exit 1; }
[ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ] || { error 'Abra este instalador no seu desktop Linux.'; exit 1; }
case "$mode" in
  --terminal)
    printf '\nLocalNeuron · Instalação automática\nAguarde. O aplicativo abrirá quando a instalação terminar.\n\n'
    bash "$installer" --install > "$log" 2>&1
    result=$?
    cat "$log"
    ;;
  --gui)
    if ! command -v zenity >/dev/null; then
      # Fall back to a terminal window without asking the user to type commands.
      if command -v alacritty >/dev/null; then exec alacritty -e bash "$self" --terminal
      elif command -v kitty >/dev/null; then exec kitty bash "$self" --terminal
      elif command -v ghostty >/dev/null; then exec ghostty -e bash "$self" --terminal
      elif command -v foot >/dev/null; then exec foot bash "$self" --terminal
      elif command -v konsole >/dev/null; then exec konsole -e bash "$self" --terminal
      elif command -v gnome-terminal >/dev/null; then exec gnome-terminal --wait -- bash "$self" --terminal
      elif command -v x-terminal-emulator >/dev/null; then exec x-terminal-emulator -e bash "$self" --terminal
      elif command -v xterm >/dev/null; then exec xterm -e bash "$self" --terminal
      else error 'Nenhuma janela de instalação disponível. É necessário Zenity ou um terminal gráfico.'; exit 1; fi
    fi
    command -v setsid >/dev/null || { error 'O util-linux (setsid) é necessário para instalar.'; exit 1; }
    setsid bash "$installer" --install > "$log" 2>&1 &
    worker=$!
    # Closing/cancelling the window terminates the entire extraction process group.
    { while kill -0 "$worker" 2>/dev/null; do printf '10\n' || break; sleep 0.2; done; printf '100\n'; } | zenity --progress --pulsate --auto-close --title='Instalando LocalNeuron' --width=460 --text='Preparando e verificando o aplicativo…\nEle abrirá automaticamente quando estiver pronto.'
    progress_result=${PIPESTATUS[1]}
    if [ "$progress_result" != 0 ]; then
      cleanup
      worker=''
      exit 130
    fi
    wait "$worker"
    result=$?
    worker=''
    ;;
  *) error 'Opção inválida.'; exit 1 ;;
esac
if [ "$result" != 0 ]; then
  error "A instalação não terminou. O aplicativo não será aberto.
$(tail -n 8 "$log")"
  if [ "$mode" = --terminal ] && [ -t 0 ]; then read -r -p 'Pressione Enter para fechar…' answer || true; fi
  exit "$result"
fi
base=${XDG_DATA_HOME:-"$HOME/.local/share"}/localneuron
# No login autostart is registered. Launch only after the verified installer succeeds.
nohup "$base/start" >> "$log" 2>&1 < /dev/null &
printf 'Instalação concluída. Abrindo LocalNeuron…\n'
exit 0
