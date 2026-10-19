#!/bin/zsh
set -eu
cd "$(dirname "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  print 'Instale Node.js 24 ou superior para iniciar o LocalNeuron.'
  read -k 1
  exit 1
fi
node_version=$(node -v)
node_major=${node_version#v}
node_major=${node_major%%.*}
if (( node_major < 24 )); then
  print 'Instale Node.js 24 ou superior para iniciar o LocalNeuron.'
  read -k 1
  exit 1
fi
if [[ ! -d node_modules ]]; then
  print 'Execute npm ci nesta pasta antes de iniciar.'
  read -k 1
  exit 1
fi
npm run build
npm run desktop
