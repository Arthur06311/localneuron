#!/bin/sh
# Sobe o serviço de cobrança como usuário não root.
# A chave privada, se vier em LOCALNEURON_LICENSE_PRIVATE_KEY, é gravada
# só na memória temporária do contêiner e some do ambiente antes do Node.
set -eu
umask 077

if [ -n "${LOCALNEURON_LICENSE_PRIVATE_KEY:-}" ]; then
  printf '%s\n' "$LOCALNEURON_LICENSE_PRIVATE_KEY" > /tmp/license-private.pem
  chmod 600 /tmp/license-private.pem
  export LOCALNEURON_LICENSE_PRIVATE_KEY_FILE=/tmp/license-private.pem
  unset LOCALNEURON_LICENSE_PRIVATE_KEY
fi

if [ ! -w /data ]; then
  echo "A pasta /data não pode ser gravada por este usuário." >&2
  echo "No Fly, uma vez: fly ssh console --user root -a localneuron-billing -C \"chown node:node /data && chmod 700 /data\"" >&2
  exit 1
fi

exec "$@"
