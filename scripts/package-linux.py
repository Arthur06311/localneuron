#!/usr/bin/env python3
"""Build a verified, offline per-user installer from an Electron Linux bundle."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parent.parent
REQUIRED = ['LocalNeuron', 'v8_context_snapshot.bin', 'snapshot_blob.bin', 'icudtl.dat',
            'resources.pak', 'chrome_100_percent.pak', 'chrome_200_percent.pak',
            'resources/app/package.json', 'resources/app/dist/src/server.js',
            'resources/app/public/app-icon.png']

def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()

def build(source, output, arch, native_output=None):
    source = source.resolve()
    for name in REQUIRED:
        if not (source / name).is_file() or not (source / name).stat().st_size:
            raise ValueError('Pacote incompleto: ' + name)
    if not os.access(source / 'LocalNeuron', os.X_OK):
        raise ValueError('LocalNeuron precisa ser executável')
    version = json.loads((source / 'resources/app/package.json').read_text())['version']
    if not re.fullmatch(r'\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?', version):
        raise ValueError('Versão inválida')
    config = json.loads((source / 'resources/app/subscription-config.json').read_text())
    if set(config) != {'serviceUrl', 'publicKey'} or 'PRIVATE KEY' in json.dumps(config):
        raise ValueError('Configuração pública de assinatura inválida')
    paths = sorted(source.rglob('*'))
    # Never follow an external symlink or include private workspaces in a release.
    for path in paths:
        relative = path.relative_to(source).as_posix()
        if any(c in relative for c in '\n\r\\'):
            raise ValueError('Nome não suportado: ' + relative)
        if any(p in {'.desktop', '.data', 'Colmeia-data', 'models', '.git'} for p in path.relative_to(source).parts):
            raise ValueError('Dados privados no pacote: ' + relative)
        if path.is_symlink() and (os.path.isabs(os.readlink(path)) or not path.resolve().is_relative_to(source)):
            raise ValueError('Link fora do pacote: ' + relative)
        if not path.is_file() and not path.is_dir() and not path.is_symlink():
            raise ValueError('Tipo de arquivo não suportado: ' + relative)
    output = output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='localneuron-installer-') as temporary:
        scratch = Path(temporary)
        hashes = {p.relative_to(source).as_posix(): digest(p) for p in paths if p.is_file() and not p.is_symlink()}
        launcher = scratch / 'launch.sh'
        shutil.copyfile(ROOT / 'packaging/linux/launch.sh', launcher)
        launcher.chmod(0o755)
        hashes['launch.sh'] = digest(launcher)
        manifest = scratch / 'files.sha256'
        startup = scratch / 'startup.sha256'
        startup.write_text(''.join(f'{hashes[name]}  {name}\n' for name in REQUIRED if name != 'LocalNeuron'))
        hashes['startup.sha256'] = digest(startup)
        manifest.write_text(''.join(f'{value}  {name}\n' for name, value in hashes.items()))
        payload = scratch / 'payload.tar.gz'
        with tarfile.open(payload, 'w:gz', compresslevel=6, format=tarfile.PAX_FORMAT) as archive:
            for path in paths:
                archive.add(path, arcname=path.relative_to(source).as_posix(), recursive=False)
            for name in ['launch.sh', 'files.sha256', 'startup.sha256']:
                archive.add(scratch / name, arcname=name)
        header = (ROOT / 'packaging/linux/install.sh').read_text()
        for key, value in {'VERSION': version, 'ARCH': arch, 'SHA256': digest(payload),
                           'BYTES': str(payload.stat().st_size),
                           'DISK_KB': str(sum(p.stat().st_size for p in paths if p.is_file()) // 1024 + payload.stat().st_size // 1024 + 65536)}.items():
            header = header.replace('@' + key + '@', value)
        header = header.replace('@PAYLOAD_LINE@', str(header.count('\n') + 1))
        part = output.with_suffix(output.suffix + '.part')
        try:
            with part.open('wb') as destination, payload.open('rb') as stream:
                destination.write(header.encode())
                shutil.copyfileobj(stream, destination)
            part.chmod(0o755)
            part.replace(output)
        finally:
            part.unlink(missing_ok=True)
        if native_output is not None:
            import importlib.util
            spec = importlib.util.spec_from_file_location('native_packages', ROOT / 'scripts/package-linux-native.py')
            native = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(native)
            native.build(source, native_output, arch, support=scratch)
    checksum = digest(output)
    output.with_suffix(output.suffix + '.sha256').write_text(f'{checksum}  {output.name}\n')
    print(json.dumps({'file': str(output), 'version': version, 'bytes': output.stat().st_size, 'sha256': checksum}))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--arch', choices=['x64', 'arm64'], default='x64')
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--native-output', type=Path, help='Also build DEB and Arch packages in this directory')
    args = parser.parse_args()
    build(args.source, args.output, args.arch, args.native_output)
