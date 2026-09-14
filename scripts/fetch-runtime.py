#!/usr/bin/env python3
"""Obtain only the pinned official llama.cpp runtime; never download model weights."""
import hashlib, io, json, platform, sys, tarfile, tempfile, urllib.request, zipfile, shutil
from pathlib import Path
root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'runtime/manifest.json').read_text())
system = {'Darwin': 'darwin', 'Windows': 'win32', 'Linux': 'linux'}[platform.system()]
arch = 'arm64' if platform.machine().lower() in ['arm64', 'aarch64'] else 'x64'
target_name = sys.argv[1] if len(sys.argv) > 1 else system + '-' + arch
asset = manifest['assets'].get(target_name)
if not asset:
    raise SystemExit('Runtime integrado não disponível para ' + target_name)
target = root / 'runtime' / target_name
binary = target / ('llama-server.exe' if target_name.startswith('win32') else 'llama-' + manifest['release'] + '/llama-server')
if binary.is_file():
    print('Runtime presente: ' + target_name)
    raise SystemExit(0)
with urllib.request.urlopen(asset['url'], timeout=60) as response:
    data = response.read(asset['bytes'] + 1)
if len(data) != asset['bytes'] or hashlib.sha256(data).hexdigest() != asset['sha256']:
    raise SystemExit('Runtime com tamanho ou hash divergente')
with tempfile.TemporaryDirectory(prefix='colmeia-runtime-') as scratch:
    if asset['url'].endswith('.zip'):
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            for name in archive.namelist():
                if Path(name).is_absolute() or '..' in Path(name).parts:
                    raise SystemExit('Caminho inválido no pacote')
            archive.extractall(scratch)
    else:
        with tarfile.open(fileobj=io.BytesIO(data)) as archive:
            archive.extractall(scratch, filter='data')
    if target.exists():
        raise SystemExit('Pasta incompleta já existe; examine antes de substituir: ' + str(target))
    shutil.copytree(scratch, target, symlinks=True)
print('Runtime verificado: ' + target_name)
