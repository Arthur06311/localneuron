#!/usr/bin/env bash
# LocalNeuron offline installer. The binary payload starts after the final exit.
set -euo pipefail
umask 022
version='@VERSION@'
arch='@ARCH@'
expected='@SHA256@'
bytes='@BYTES@'
payload_line='@PAYLOAD_LINE@'
required_kb='@DISK_KB@'
mode=${1:---install}
fail() { printf 'LocalNeuron: %s\n' "$*" >&2; exit 1; }
case "$mode" in
  --help|-h) printf 'LocalNeuron %s · Linux %s\n\nInstalar: bash "%s"\nVerificar download: bash "%s" --check\nInstala apenas para seu usuário, sem sudo. Não altera modelos/conversas.\n' "$version" "$arch" "$0" "$0"; exit 0 ;;
  --install|--check) ;;
  *) fail 'Opção inválida. Use --help.' ;;
esac
[ "$#" -le 1 ] || fail 'Use somente --install ou --check.'
[ "$(uname -s)" = Linux ] || fail 'Este instalador é para Linux.'
for tool in sha256sum tail tar mktemp wc df awk readlink flock; do command -v "$tool" >/dev/null || fail "Comando necessário ausente: $tool"; done
if [ "$mode" = --install ]; then
  [ "$(id -u)" != 0 ] || fail 'Execute com seu usuário normal, sem sudo.'
  machine=$(uname -m)
  case "$arch:$machine" in x64:x86_64|arm64:aarch64|arm64:arm64) ;; *) fail "Arquitetura incompatível: pacote $arch, computador $machine." ;; esac
fi
scratch=''
cleanup() { [ -z "$scratch" ] || rm -rf -- "$scratch"; }
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
if [ "$mode" = --install ]; then
  data=${XDG_DATA_HOME:-"$HOME/.local/share"}
  case "$data" in /*) ;; *) fail 'XDG_DATA_HOME deve ser um caminho absoluto.' ;; esac
  # Newlines cannot be represented safely in desktop-entry paths.
  case "$data" in *$'\n'*|*$'\r'*) fail 'Caminho de instalação inválido.' ;; esac
  base="$data/localneuron"
  mkdir -p -- "$base/versions"
  exec 9>"$base/install.lock"
  flock -n 9 || fail 'Outra instalação está em andamento. Aguarde terminar.'
  available=$(df -Pk "$base" | awk 'END {print $4}')
  [ "$available" -ge "$required_kb" ] || fail "Espaço insuficiente: são necessários cerca de $required_kb KiB livres."
  scratch=$(mktemp -d "$base/.install-XXXXXXXX")
else
  scratch=$(mktemp -d)
fi
printf '1/3 · Verificando o download completo…\n'
tail -n +"$payload_line" -- "$0" > "$scratch/payload.tar.gz"
actual=$(wc -c < "$scratch/payload.tar.gz" | tr -d ' ')
[ "$actual" = "$bytes" ] || fail 'Download incompleto ou alterado. Aguarde terminar ou baixe novamente.'
printf '%s  %s\n' "$expected" "$scratch/payload.tar.gz" | sha256sum -c --status || fail 'A verificação SHA-256 falhou. Baixe novamente do site oficial.'
if [ "$mode" = --check ]; then printf 'Download íntegro · LocalNeuron %s (%s).\n' "$version" "$arch"; exit 0; fi
printf '2/3 · Instalando e conferindo todos os arquivos. Aguarde…\n'
mkdir "$scratch/app"
tar -xzf "$scratch/payload.tar.gz" -C "$scratch/app" --no-same-owner --no-same-permissions
(cd "$scratch/app" && sha256sum -c --quiet files.sha256) || fail 'Falha na extração. A instalação anterior foi preservada.'
[ -x "$scratch/app/LocalNeuron" ] || fail 'Executável ausente ou sem permissão.'
[ -s "$scratch/app/v8_context_snapshot.bin" ] || fail 'Snapshot V8 ausente.'
# Versions are immutable; only a completely verified directory becomes current.
release="$version-$arch-${expected:0:16}"
destination="$base/versions/$release"
if [ -e "$destination" ]; then
  if ! (cd "$destination" && sha256sum -c --quiet files.sha256); then
    printf 'Reparando instalação danificada em uma nova pasta…\n'
    destination=$(mktemp -d "$base/versions/$release-repair-XXXXXXXX")
    rmdir -- "$destination"
    release=${destination##*/}
    mv -- "$scratch/app" "$destination"
  fi
else
  mv -- "$scratch/app" "$destination"
fi
printf '3/3 · Adicionando LocalNeuron ao menu de aplicativos…\n'
# Resolve current once per launch, so a simultaneous upgrade cannot mix versions.
cat > "$scratch/start" <<'LAUNCH'
#!/usr/bin/env bash
set -eu
base=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
release=$(readlink -f -- "$base/current")
exec "$release/launch.sh" "$@"
LAUNCH
chmod 755 "$scratch/start"
mkdir -p "$data/applications"
# Desktop Exec requires both desktop-string and quoted-argument escaping.
exec_path=${base//\\/\\\\\\\\}; exec_path=${exec_path//\"/\\\\\"}; exec_path=${exec_path//\$/\\\\\$}; exec_path=${exec_path//\`/\\\\\`}; exec_path=${exec_path//%/%%}
icon_path=${base//\\/\\\\}
cat > "$scratch/localneuron.desktop" <<DESKTOP
[Desktop Entry]
Version=1.0
Type=Application
Name=LocalNeuron
Comment=Suas IAs locais
Exec="$exec_path/start"
Icon=$icon_path/current/resources/app/public/app-icon.png
Terminal=false
Categories=Utility;
StartupNotify=true
StartupWMClass=LocalNeuron
DESKTOP
# Each published entry is replaced atomically on the same filesystem.
ln -s "versions/$release" "$scratch/current"
mv -Tf -- "$scratch/current" "$base/current"
mv -f -- "$scratch/start" "$base/start"
# XDG applications may be a separate mount; create its temporary file there.
desktop_tmp=$(mktemp "$data/applications/.localneuron-XXXXXXXX")
cp "$scratch/localneuron.desktop" "$desktop_tmp"
chmod 644 "$desktop_tmp"
mv -f -- "$desktop_tmp" "$data/applications/localneuron.desktop"
if command -v update-desktop-database >/dev/null; then update-desktop-database "$data/applications" >/dev/null 2>&1 || true; fi
printf '\nLocalNeuron %s instalado. Abra “LocalNeuron” no menu de aplicativos.\nPara abrir pelo terminal: "%s/start"\nDiagnóstico: "%s/start" --diagnose\nModelos e conversas existentes foram preservados.\n' "$version" "$base" "$base"
exit 0
