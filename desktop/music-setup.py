"""Install a pinned ACE-Step release in the user's private engine directory."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import urllib.request
import zipfile

REVISION = 'ca1e85fe9430179831e6bc6be790c332190a3866'
SHA256 = '108e45dffc7eb62af98d781c4159aa63a2b7a241186734e3e065279da7fc198d'
home = Path(sys.argv[1]).resolve()
home.mkdir(parents=True, exist_ok=True)
if shutil.disk_usage(home).free < 25 * 1024**3:
    raise RuntimeError('Reserve pelo menos 25 GiB livres para motor, dependências e modelos.')
env = dict(os.environ, UV_CACHE_DIR=str(home / 'uv-cache'), UV_PYTHON_INSTALL_DIR=str(home / 'python'), HF_HUB_DISABLE_TELEMETRY='1', DO_NOT_TRACK='1', PYTHONUNBUFFERED='1')


def run(args, cwd=home):
    subprocess.run(args, cwd=cwd, env=env, check=True)


print('Preparando instalador isolado…', flush=True)
run([sys.executable, '-m', 'pip', 'install', '--disable-pip-version-check', '--target', str(home / 'bootstrap'), 'uv==0.12.13'])
env['PYTHONPATH'] = str(home / 'bootstrap')
uv = [sys.executable, '-m', 'uv']
archive = home / 'source.zip'
print('Baixando e verificando o código do ACE-Step…', flush=True)
urllib.request.urlretrieve('https://codeload.github.com/ACE-Step/ACE-Step-1.5/zip/' + REVISION, archive)
if hashlib.sha256(archive.read_bytes()).hexdigest() != SHA256:
    raise RuntimeError('O SHA-256 do motor não confere.')
with zipfile.ZipFile(archive) as package:
    for member in package.infolist():
        dest = (home / member.filename).resolve()
        if not dest.is_relative_to(home) or (member.external_attr >> 16) & 0o170000 == 0o120000:
            raise RuntimeError('Caminho inesperado no pacote.')
    package.extractall(home)
source = home / ('ACE-Step-1.5-' + REVISION)
print('Instalando dependências e Python 3.11…', flush=True)
run(uv + ['sync', '--python', '3.11', '--frozen', '--no-dev'], source)
print('Baixando 6,32 GB de modelos oficiais (Turbo, texto e áudio)…', flush=True)
env['HF_HUB_DISABLE_XET'] = '1'
run(uv + ['run', '--no-sync', 'python', '-c', "from huggingface_hub import snapshot_download; snapshot_download('ACE-Step/Ace-Step1.5', revision='19671f406d603126926c1b7e2adc169acbcade22', local_dir='checkpoints', allow_patterns=['acestep-v15-turbo/*','Qwen3-Embedding-0.6B/*','vae/*'], max_workers=3)"], source)
print('Verificando SHA-256 dos pesos baixados…', flush=True)
weights = {
    'acestep-v15-turbo/model.safetensors': '3f6e0797fad420a39bd33979eb6e840e30989e34a3794e843d23b60ec6e422d7',
    'Qwen3-Embedding-0.6B/model.safetensors': '0437e45c94563b09e13cb7a64478fc406947a93cb34a7e05870fc8dcd48e23fd',
    'vae/diffusion_pytorch_model.safetensors': 'da17edb604c40deaf09e9b24974e590d1ca83a374070e5d0884cfa4bed9a99b0',
}
for name, expected in weights.items():
    path = source / 'checkpoints' / name
    def digest():
        with path.open('rb') as handle:
            digest = hashlib.sha256()
            for block in iter(lambda: handle.read(8 * 1024**2), b''):
                digest.update(block)
            return digest.hexdigest()
    if digest() != expected:
        print('Reparando download incompleto: ' + name, flush=True)
        code = "from huggingface_hub import hf_hub_download; hf_hub_download('ACE-Step/Ace-Step1.5', " + repr(name) + ", revision='19671f406d603126926c1b7e2adc169acbcade22', local_dir='checkpoints', force_download=True)"
        run(uv + ['run', '--no-sync', 'python', '-c', code], source)
    if digest() != expected:
        raise RuntimeError('O SHA-256 dos pesos não confere: ' + name)
(home / 'installed.json').write_text(json.dumps({'revision': REVISION, 'source': str(source), 'verified': True}))
print('Motor e modelos instalados. Pronto para iniciar offline.', flush=True)
