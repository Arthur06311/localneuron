#!/bin/sh
# Sobe o serviço de cobrança. Começa como root para o volume do Fly em /data
# ficar gravável pelo usuário node, e em seguida abandona o root com setpriv.
# A chave privada, se vier em LOCALNEURON_LICENSE_PRIVATE_KEY, é gravada
# só na memória temporária do contêiner e some do ambiente antes do Node.
set -eu
umask 077

if [ "$(id -u)" -eq 0 ]; then
  mkdir -p /data
  chown node:node /data
  chmod 700 /data
  if [ -n "${LOCALNEURON_LICENSE_PRIVATE_KEY:-}" ]; then
    printf '%s\n' "$LOCALNEURON_LICENSE_PRIVATE_KEY" > /tmp/license-private.pem
    chown node:node /tmp/license-private.pem
    chmod 600 /tmp/license-private.pem
    export LOCALNEURON_LICENSE_PRIVATE_KEY_FILE=/tmp/license-private.pem
    unset LOCALNEURON_LICENSE_PRIVATE_KEY
  fi
  exec setpriv --reuid=node --regid=node --init-groups --inh-caps=-all "$0" "$@"
fi

exec "$@"
