#!/usr/bin/env python3
"""Create the public drag-to-Applications DMG from the verified distribution ZIP."""
import argparse
import json
from pathlib import Path
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--zip', type=Path, default=root / 'LocalNeuron-macOS-arm64.zip')
parser.add_argument('--output', type=Path, default=root / 'LocalNeuron-macOS-arm64.dmg')
args = parser.parse_args()
output = args.output.resolve()
output.parent.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory(prefix='localneuron-dmg-') as scratch:
    staging = Path(scratch) / 'volume'
    staging.mkdir()
    subprocess.run(['ditto', '-x', '-k', str(args.zip.resolve()), str(staging)], check=True)
    if sorted(p.name for p in staging.iterdir()) != ['LocalNeuron.app']:
        raise SystemExit('O ZIP deve conter apenas o aplicativo público LocalNeuron.app.')
    bundle = staging / 'LocalNeuron.app'
    app = bundle / 'Contents/Resources/app'
    config = json.loads((app / 'subscription-config.json').read_text())
    public_config = json.loads((root / 'subscription-config.json').read_text())
    if config != public_config:
        raise SystemExit('O DMG deve usar exatamente a configuração pública de distribuição.')
    forbidden = {'Colmeia-data', '.desktop', '.data', 'session.json', 'vault.enc.json', 'subscription.json'}
    if any(p.name in forbidden for p in app.rglob('*')):
        raise SystemExit('O aplicativo contém dados locais e não pode ser distribuído.')
    subprocess.run(['codesign', '--verify', '--deep', '--strict', str(bundle)], check=True)
    (staging / 'Applications').symlink_to('/Applications', target_is_directory=True)
    (staging / 'Instalar - Install.txt').write_text(
        'LocalNeuron para Mac com Apple Silicon\n\n'
        '1. Arraste LocalNeuron.app para Applications (Aplicativos).\n'
        '2. Ejete este disco e abra LocalNeuron na pasta Aplicativos.\n'
        '3. Baixe seus modelos dentro do aplicativo.\n\n'
        'LocalNeuron for Apple Silicon Mac\n\n'
        '1. Drag LocalNeuron.app into Applications.\n'
        '2. Eject this disk and open LocalNeuron from Applications.\n'
        '3. Download your models inside the app.\n', encoding='utf-8')
    temporary = Path(scratch) / output.name
    subprocess.run(['hdiutil', 'create', '-volname', 'LocalNeuron', '-srcfolder', str(staging),
                    '-fs', 'HFS+', '-format', 'UDZO', '-imagekey', 'zlib-level=9', str(temporary)], check=True)
    subprocess.run(['hdiutil', 'verify', str(temporary)], check=True)
    # Move the completed image only after verification; preserve any previous output on failure.
    import shutil
    shutil.copyfile(temporary, output.with_suffix('.dmg.part'))
    output.with_suffix('.dmg.part').replace(output)
print(f'DMG público criado e verificado: {output.name}')
