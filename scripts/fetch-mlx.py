#!/usr/bin/env python3
"""Build-only: assemble pinned, relocatable Python + MLX; no LM Studio files."""
import hashlib
import io
import json
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
import urllib.request

root = Path(__file__).resolve().parents[1]
manifest_file = root / 'runtime/mlx-manifest.json'
manifest = json.loads(manifest_file.read_text())
target = root / 'runtime/mlx-darwin-arm64'
fingerprint = hashlib.sha256(manifest_file.read_bytes()).hexdigest()
if (target / 'manifest.sha256').is_file() and (target / 'manifest.sha256').read_text().strip() == fingerprint and (target / 'python/bin/python3').exists():
    print('MLX independente presente e fixado pelo manifesto.'); raise SystemExit(0)
if target.exists():
    raise SystemExit('Pasta de MLX incompleta ou divergente. Examine antes de substituir: ' + str(target))

def download(asset):
    with urllib.request.urlopen(asset['url'], timeout=60) as response:
        data = response.read()
    if hashlib.sha256(data).hexdigest() != asset['sha256'] or ('bytes' in asset and len(data) != asset['bytes']):
        raise ValueError('Download de runtime com hash ou tamanho divergente.')
    return data

with tempfile.TemporaryDirectory(prefix='colmeia-mlx-') as scratch:
    scratch = Path(scratch)
    with tarfile.open(fileobj=io.BytesIO(download(manifest['python']))) as archive:
        archive.extractall(scratch, filter='data')
    wheels = scratch / 'wheels'; wheels.mkdir()
    for package in manifest['packages']:
        name = package['url'].rsplit('/', 1)[-1]
        if not name.endswith('.whl') or Path(name).name != name:
            raise ValueError('Pacote deve ser uma wheel fixa.')
        (wheels / name).write_bytes(download(package))
    python = scratch / 'python/bin/python3'
    subprocess.run([str(python), '-I', '-m', 'pip', 'install', '--no-index', '--no-deps', '--disable-pip-version-check'] + [str(p) for p in sorted(wheels.glob('*.whl'))], check=True)
    shutil.rmtree(wheels)
    (scratch / 'manifest.sha256').write_text(fingerprint + '\n')
    shutil.copytree(scratch, target, symlinks=True)
print('Python e MLX incluídos com hashes conferidos; instalação do usuário não é necessária.')
