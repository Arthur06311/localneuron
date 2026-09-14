#!/usr/bin/env python3
"""Build a local ARM64 app without copying workspace data or credentials."""
from pathlib import Path
import argparse
import plistlib
import re
import json
import shutil
import subprocess
import tempfile
import urllib.request

root = Path(__file__).resolve().parents[1]
target = root / 'LocalNeuron.app'
parser = argparse.ArgumentParser()
parser.add_argument('--local-subscription-config', type=Path, help='Chave pública de teste somente para a instalação local; nunca incluída no ZIP ou DMG.')
args = parser.parse_args()
local_config = None
if args.local_subscription_config:
    local_config = json.loads(args.local_subscription_config.read_text())
    if set(local_config) != {'serviceUrl', 'publicKey'} or local_config['serviceUrl'] is not None or not isinstance(local_config['publicKey'], str) or not local_config['publicKey'].startswith('-----BEGIN PUBLIC KEY-----') or 'PRIVATE KEY' in local_config['publicKey'] or len(local_config['publicKey']) > 4096:
        raise SystemExit('Use apenas uma chave pública de teste, sem serviço de cobrança.')


def ignore_runtime_conflicts(folder, names):
    # File Provider may create numbered conflict copies of the pinned binaries.
    # Keep the canonical file, without hydrating or modifying the duplicate.
    return [name for name in names if (canonical := re.sub(r' \d+(?=\.|$)', '', name)) != name
            and (Path(folder) / canonical).exists()]

try:
    urllib.request.urlopen('http://127.0.0.1:4318/', timeout=1)
except OSError:
    pass
else:
    raise SystemExit('Feche o LocalNeuron antes de substituir o aplicativo.')

subprocess.run(['python3', str(root / 'scripts/fetch-runtime.py'), 'darwin-arm64'], cwd=root, check=True)
subprocess.run(['python3', str(root / 'scripts/fetch-mlx.py')], cwd=root, check=True)
subprocess.run(['python3', str(root / 'scripts/fetch-tools.py'), 'darwin-arm64'], cwd=root, check=True)

subprocess.run(['python3', str(root / 'scripts/fetch-voice-node.py'), 'darwin-arm64'], cwd=root, check=True)

subprocess.run(['node', str(root / 'scripts/validate-subscription.mjs')], cwd=root, check=True)

with tempfile.TemporaryDirectory(prefix='colmeia-package-') as scratch:
    bundle = Path(scratch) / 'LocalNeuron.app'
    shutil.copytree(root / 'node_modules/electron/dist/Electron.app', bundle, symlinks=True)
    resources = bundle / 'Contents/Resources'
    (resources / 'default_app.asar').unlink(missing_ok=True)
    app = resources / 'app'
    app.mkdir()
    for name in ['package.json', 'package-lock.json', 'subscription-config.json', 'dist', 'desktop', 'public', 'workflows', 'THIRD_PARTY.md', 'licenses']:
        source = root / name
        if source.is_dir():
            shutil.copytree(source, app / name, ignore=ignore_runtime_conflicts if name == 'public' else None)
        else:
            shutil.copy2(source, app / name)
    (app / 'runtime').mkdir()
    for name in ['manifest.json', 'LICENSE.llama.cpp', 'tools-manifest.json','LICENSE.whisper.cpp']:
        shutil.copy2(root / 'runtime' / name, app / 'runtime' / name)
    shutil.copytree(root / 'runtime/tools-darwin-arm64', app / 'runtime/tools-darwin-arm64', symlinks=True, ignore=ignore_runtime_conflicts)
    shutil.copy2(root / 'runtime/voice-node-manifest.json', app / 'runtime/voice-node-manifest.json')
    shutil.copytree(root / 'runtime/voice-node-darwin-arm64', app / 'runtime/voice-node-darwin-arm64')
    shutil.copytree(root / 'runtime/darwin-arm64', app / 'runtime/darwin-arm64', symlinks=True)
    for name in ['mlx-manifest.json', 'mlx_server.py', 'mlx_protocol.py']:
        shutil.copy2(root / 'runtime' / name, app / 'runtime' / name)
    shutil.copytree(root / 'runtime/mlx-darwin-arm64', app / 'runtime/mlx-darwin-arm64', symlinks=True, ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
    subprocess.run(['npm', 'ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], cwd=app, check=True)
    plist = bundle / 'Contents/Info.plist'
    data = plistlib.loads(plist.read_bytes())
    data.update(CFBundleName='LocalNeuron', CFBundleDisplayName='LocalNeuron',
                CFBundleIdentifier='dev.colmeia.local', CFBundleShortVersionString=json.loads((root / 'package.json').read_text())['version'], CFBundleVersion='26', NSAppleEventsUsageDescription='O LocalNeuron controla aplicativos somente quando você habilita o controle e aprova a ação.', NSMicrophoneUsageDescription='O LocalNeuron usa o microfone para transcrever sua fala localmente com Whisper.')
    plist.write_bytes(plistlib.dumps(data))
    # Sign away from macOS File Provider, which recreates FinderInfo on bundles.
    for attribute in ['com.apple.FinderInfo', 'com.apple.ResourceFork']:
        subprocess.run(['xattr', '-dr', attribute, str(bundle)], check=False, stderr=subprocess.DEVNULL)
    subprocess.run(['codesign', '--force', '--deep', '--sign', '-', str(bundle)], check=True)
    subprocess.run(['codesign', '--verify', '--deep', '--strict', str(bundle)], check=True)
    subprocess.run(['ditto', '-c', '-k', '--keepParent', str(bundle), str(root / 'LocalNeuron-macOS-arm64.zip')], check=True)
    subprocess.run(["python3", str(root / "scripts/package-dmg.py")], cwd=root, check=True)
    # Public ZIP and DMG are sealed before applying the local test configuration.
    if local_config is not None:
        (app / 'subscription-config.json').write_text(json.dumps(local_config, indent=2) + '\n')
        subprocess.run(['codesign', '--force', '--deep', '--sign', '-', str(bundle)], check=True)
        subprocess.run(['codesign', '--verify', '--deep', '--strict', str(bundle)], check=True)
    if target.exists():
        if (target / 'Contents/Resources/app/.desktop').exists():
            raise SystemExit('Há dados no bundle antigo. Migre-os antes de substituir.')
        shutil.rmtree(target)
    shutil.copytree(bundle, target, symlinks=True)

# Replacing the bundle can leave Launch Services pointing at an earlier release.
# Keep registration scoped to this application; Spotlight indexing is asynchronous.
target.touch()
for command in [
    ['/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister', '-f', str(target)],
    ['/usr/bin/mdimport', '-i', str(target)],
]:
    try:
        subprocess.run(command, check=True, timeout=30, capture_output=True)
    except (OSError, subprocess.SubprocessError) as error:
        print(f'Aviso: registro do aplicativo não atualizado: {error}')

print('LocalNeuron.app, ZIP e DMG criados. Assinatura ad hoc; sem notarização de distribuição.')
