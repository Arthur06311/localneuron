#!/usr/bin/env python3
"""Validate an Electron Packager directory before wrapping it as an installer."""
import json
import os
from pathlib import Path
import re

VERSION_PATTERN = re.compile(r'^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$')
PRIVATE_PARTS = {'.git', '.desktop', '.data', 'models', 'Colmeia-data'}
SECRET_SUFFIXES = {'.pem', '.key', '.p12', '.pfx'}

LINUX_FILES = [
    'LocalNeuron', 'chrome-sandbox', 'v8_context_snapshot.bin', 'snapshot_blob.bin',
    'icudtl.dat', 'resources.pak', 'chrome_100_percent.pak', 'chrome_200_percent.pak',
    'resources/app/package.json', 'resources/app/dist/src/server.js',
    'resources/app/public/app-icon.png', 'resources/app/subscription-config.json',
]
WINDOWS_FILES = [
    'LocalNeuron.exe', 'v8_context_snapshot.bin', 'snapshot_blob.bin',
    'resources/app/package.json', 'resources/app/dist/src/server.js',
    'resources/app/subscription-config.json',
]


def validate_bundle(source, required, executable):
    source = source.resolve()
    if not source.is_dir():
        raise ValueError('Pasta do Electron Packager não encontrada: ' + str(source))
    for name in required:
        path = source / name
        if not path.is_file() or path.is_symlink() or path.stat().st_size == 0:
            raise ValueError('Pacote incompleto: ' + name)
    binary = source / executable
    if executable == 'LocalNeuron' and not os.access(binary, os.X_OK):
        raise ValueError('LocalNeuron precisa ser executável')
    version = json.loads((source / 'resources/app/package.json').read_text(encoding='utf-8'))['version']
    if not isinstance(version, str) or not VERSION_PATTERN.fullmatch(version):
        raise ValueError('Versão inválida no pacote')
    config_path = source / 'resources/app/subscription-config.json'
    config = json.loads(config_path.read_text(encoding='utf-8'))
    if set(config) != {'serviceUrl', 'publicKey'} or 'PRIVATE KEY' in json.dumps(config):
        raise ValueError('Configuração pública de assinatura inválida')
    for path in sorted(source.rglob('*')):
        relative = path.relative_to(source)
        text = relative.as_posix()
        if any(part in PRIVATE_PARTS for part in relative.parts) or path.name == '.env' or path.suffix.lower() in SECRET_SUFFIXES:
            raise ValueError('Dado privado ou segredo no pacote: ' + text)
        if any(char in text for char in '\n\r\\$`"'):
            raise ValueError('Nome não suportado: ' + text)
        if path.is_symlink():
            link = os.readlink(path)
            if os.path.isabs(link) or not path.resolve().is_relative_to(source):
                raise ValueError('Link fora do pacote: ' + text)
        elif not path.is_file() and not path.is_dir():
            raise ValueError('Tipo de arquivo não suportado: ' + text)
    return version
