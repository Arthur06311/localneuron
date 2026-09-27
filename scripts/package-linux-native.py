#!/usr/bin/env python3
"""Build Debian and Arch packages with a root-owned Electron sandbox helper."""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import re
import tarfile
import tempfile

APP = 'opt/localneuron'
PROFILE = '''abi <abi/4.0>,
include <tunables/global>
profile localneuron /opt/localneuron/LocalNeuron flags=(unconfined) {
  userns,
  include if exists <local/localneuron>
}
'''
DESKTOP = '''[Desktop Entry]
Type=Application
Name=LocalNeuron
Comment=Suas IAs locais
Exec=/opt/localneuron/launch.sh
Icon=/opt/localneuron/resources/app/public/app-icon.png
Terminal=false
Categories=Utility;
StartupWMClass=LocalNeuron
'''
POSTINST = '''#!/bin/sh
set -e
if [ "$1" = configure ] && command -v apparmor_parser >/dev/null 2>&1 && [ -r /etc/apparmor.d/abi/4.0 ] && [ -d /sys/kernel/security/apparmor ]; then
  apparmor_parser -r /etc/apparmor.d/localneuron
fi
'''
POSTRM = '''#!/bin/sh
set -e
if [ "$1" = remove ] && command -v apparmor_parser >/dev/null 2>&1 && [ -d /sys/kernel/security/apparmor ]; then
  printf '%s\n' 'profile localneuron /opt/localneuron/LocalNeuron {}' | apparmor_parser -R || true
fi
'''

def add_text(tar, name, text, mode=0o644):
    data = text.encode()
    entry = tarfile.TarInfo(name)
    entry.size, entry.mode = len(data), mode
    entry.uid = entry.gid = 0
    entry.uname = entry.gname = 'root'
    tar.addfile(entry, io.BytesIO(data))

def normalize(entry):
    entry.uid = entry.gid = 0
    entry.uname = entry.gname = 'root'
    entry.mtime = 0
    entry.mode = 0o755 if entry.isdir() or entry.mode & 0o111 else 0o644
    if entry.name == APP + '/chrome-sandbox':
        entry.mode = 0o4755
    return entry

def build(source, output, arch='x64', support=None):
    source = source.resolve()
    support = source if support is None else support.resolve()
    required = ['LocalNeuron', 'chrome-sandbox', 'v8_context_snapshot.bin', 'snapshot_blob.bin',
                'resources/app/package.json', 'resources/app/dist/src/server.js']
    for name in required:
        if not (source / name).is_file() or (source / name).is_symlink() or not (source / name).stat().st_size:
            raise ValueError('Pacote incompleto: ' + name)
    for name in ['launch.sh', 'startup.sha256']:
        if not (support / name).is_file() or (support / name).is_symlink():
            raise ValueError('Arquivo de inicialização ausente: ' + name)
    paths = sorted(source.rglob('*'))
    for path in paths:
        relative = path.relative_to(source)
        if any(p in {'.git', '.desktop', '.data', 'models', 'Colmeia-data'} for p in relative.parts):
            raise ValueError('Dados privados no pacote: ' + str(relative))
        if path.is_symlink() and (os.path.isabs(os.readlink(path)) or not path.resolve().is_relative_to(source)):
            raise ValueError('Link externo: ' + str(relative))
        if not (path.is_file() or path.is_dir() or path.is_symlink()):
            raise ValueError('Tipo de arquivo inválido')
    version = json.loads((source / 'resources/app/package.json').read_text())['version']
    if not re.fullmatch(r'\d+\.\d+\.\d+', version):
        raise ValueError('Versão inválida')
    output.mkdir(parents=True, exist_ok=True)
    debarch, pacarch = ('amd64', 'x86_64') if arch == 'x64' else ('arm64', 'aarch64')
    size = sum(p.stat().st_size for p in paths if p.is_file())
    def payload(tar):
        # Every parent is root-owned and non-writable by unprivileged users.
        for directory in ['opt', APP, 'usr', 'usr/share', 'usr/share/applications']:
            entry = tarfile.TarInfo(directory)
            entry.type = tarfile.DIRTYPE
            tar.addfile(normalize(entry))
        for path in paths:
            relative = path.relative_to(source).as_posix()
            if relative not in {'launch.sh', 'startup.sha256'}:
                tar.add(path, arcname=APP + '/' + relative, recursive=False, filter=normalize)
        for name in ['launch.sh', 'startup.sha256']:
            tar.add(support / name, arcname=APP + '/' + name, recursive=False, filter=normalize)
        add_text(tar, 'usr/share/applications/localneuron.desktop', DESKTOP)
    with tempfile.TemporaryDirectory() as temporary:
        work = Path(temporary)
        with tarfile.open(work / 'data.tar.gz', 'w:gz', format=tarfile.GNU_FORMAT, compresslevel=6) as tar:
            payload(tar)
            for directory in ['etc', 'etc/apparmor.d']:
                entry = tarfile.TarInfo(directory)
                entry.type = tarfile.DIRTYPE
                tar.addfile(normalize(entry))
            add_text(tar, 'etc/apparmor.d/localneuron', PROFILE)
        control = f'''Package: localneuron
Version: {version}-1
Architecture: {debarch}
Maintainer: LocalNeuron
Installed-Size: {size // 1024 + 16}
Depends: libgtk-3-0 | libgtk-3-0t64, libnss3, libasound2 | libasound2t64, libgbm1, libxss1, libxtst6, libgomp1, libcurl4 | libcurl4t64
Section: utils
Priority: optional
Homepage: https://localneuron.ai
Description: LocalNeuron local AI desktop
 Local models, conversations and creative tools on your computer.
'''
        with tarfile.open(work / 'control.tar.gz', 'w:gz', format=tarfile.GNU_FORMAT, compresslevel=6) as tar:
            add_text(tar, 'control', control)
            add_text(tar, 'postinst', POSTINST, 0o755)
            add_text(tar, 'postrm', POSTRM, 0o755)
            add_text(tar, 'conffiles', '/etc/apparmor.d/localneuron\n')
        deb = output / f'LocalNeuron-Linux-{arch}.deb'
        # Standard ar container used by dpkg; each member has an even byte boundary.
        with deb.open('wb') as stream:
            stream.write(b'!<arch>\n')
            for name, data in [('debian-binary', b'2.0\n'), ('control.tar.gz', (work / 'control.tar.gz').read_bytes()), ('data.tar.gz', (work / 'data.tar.gz').read_bytes())]:
                stream.write(f'{name + "/":<16}{0:<12}{0:<6}{0:<6}{"100644":<8}{len(data):<10}`\n'.encode())
                stream.write(data)
                if len(data) % 2:
                    stream.write(b'\n')
        pacman = output / f'LocalNeuron-Linux-{arch}.pkg.tar.gz'
        with tarfile.open(pacman, 'w:gz', format=tarfile.GNU_FORMAT, compresslevel=6) as tar:
            add_text(tar, '.PKGINFO', f'pkgname = localneuron\npkgbase = localneuron\npkgver = {version}-1\npkgdesc = LocalNeuron local AI desktop\nurl = https://localneuron.ai\nbuilddate = 0\npackager = LocalNeuron\nsize = {size}\narch = {pacarch}\nlicense = custom\n' + ''.join(f'depend = {p}\n' for p in ['gtk3', 'nss', 'alsa-lib', 'mesa', 'libxss', 'libxtst', 'gcc-libs', 'curl']))
            payload(tar)
    artifacts = []
    for path in [deb, pacman]:
        with path.open('rb') as stream:
            checksum = hashlib.file_digest(stream, 'sha256').hexdigest()
        path.with_suffix(path.suffix + '.sha256').write_text(f'{checksum}  {path.name}\n')
        artifacts.append({'filename': path.name, 'bytes': path.stat().st_size, 'sha256': checksum})
    print(json.dumps(artifacts))
    return artifacts

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--arch', choices=['x64', 'arm64'], default='x64')
    args = parser.parse_args()
    build(args.source, args.output, args.arch)
