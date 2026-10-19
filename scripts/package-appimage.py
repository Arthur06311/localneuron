#!/usr/bin/env python3
"""Wrap an Electron Packager Linux directory as an AppImage.

The application bundle still comes from @electron/packager. appimagetool only
packs that directory. The pinned tool is verified by SHA-256 before it runs.
"""
import argparse
import hashlib
import os
from pathlib import Path
import stat
import subprocess
import sys
import tempfile
import urllib.request

sys.path.insert(0, str(Path(__file__).resolve().parent))
import release_bundle

ROOT = Path(__file__).resolve().parent.parent
TOOL = {
    'filename': 'appimagetool-x86_64.AppImage',
    'url': 'https://github.com/AppImage/appimagetool/releases/download/1.9.1/appimagetool-x86_64.AppImage',
    'sha256': 'ed4ce84f0d9caff66f50bcca6ff6f35aae54ce8135408b3fa33abfc3cb384eb0',
}
RUNTIME = {
    'filename': 'runtime-x86_64',
    'url': 'https://github.com/AppImage/type2-runtime/releases/download/20251108/runtime-x86_64',
    'sha256': '2fca8b443c92510f1483a883f60061ad09b46b978b2631c807cd873a47ec260d',
}
APPRUN = """#!/bin/sh
set -eu
if [ -n "${APPDIR:-}" ]; then
  HERE=$APPDIR
else
  HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
fi
exec "$HERE/LocalNeuron" "$@"
"""


def desktop_entry(version):
    return '\n'.join([
        '[Desktop Entry]',
        'Type=Application',
        'Name=LocalNeuron',
        'Comment=Suas IAs locais',
        f'X-AppImage-Version={version}',
        'Exec=LocalNeuron',
        'Icon=localneuron',
        'Categories=Utility;',
        'StartupWMClass=LocalNeuron',
        'Terminal=false',
        '',
    ])


def prepare_appdir(source, appdir):
    version = release_bundle.validate_bundle(source, release_bundle.LINUX_FILES, 'LocalNeuron')
    appdir.mkdir(parents=True)
    for child in source.iterdir():
        destination = appdir / child.name
        if child.is_symlink():
            destination.symlink_to(os.readlink(child))
        elif child.is_dir():
            # copytree preserves the relative symlinks already validated above.
            import shutil
            shutil.copytree(child, destination, symlinks=True)
        else:
            import shutil
            shutil.copy2(child, destination)
    icon = appdir / 'resources/app/public/app-icon.png'
    import shutil
    shutil.copy2(icon, appdir / 'localneuron.png')
    (appdir / 'localneuron.desktop').write_text(desktop_entry(version), encoding='utf-8')
    apprun = appdir / 'AppRun'
    apprun.write_text(APPRUN, encoding='utf-8')
    apprun.chmod(apprun.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)
    return version


def cached_tool(spec, cache=None):
    directory = cache or Path(tempfile.gettempdir()) / 'localneuron-appimagetool-1.9.1'
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / spec['filename']
    if path.is_file() and hashlib.file_digest(path.open('rb'), 'sha256').hexdigest() == spec['sha256']:
        path.chmod(0o755)
        return path
    temporary = path.with_suffix(path.suffix + '.part')
    try:
        with urllib.request.urlopen(spec['url'], timeout=120) as response, temporary.open('wb') as stream:
            digest = hashlib.sha256()
            total = 0
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > 40 * 1024 * 1024:
                    raise ValueError(spec['filename'] + ' maior do que o esperado')
                digest.update(chunk)
                stream.write(chunk)
        if digest.hexdigest() != spec['sha256']:
            raise ValueError('SHA-256 não confere: ' + spec['filename'])
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)
    path.chmod(0o755)
    return path


def appimagetool(cache=None):
    return cached_tool(TOOL, cache)


def build(source, output, tool=None):
    source = Path(source).resolve()
    output = Path(output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='localneuron-appimage-') as temporary:
        appdir = Path(temporary) / 'LocalNeuron.AppDir'
        version = prepare_appdir(source, appdir)
        binary = Path(tool) if tool else appimagetool()
        binary.chmod(binary.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
        env = os.environ.copy()
        env['APPIMAGE_EXTRACT_AND_RUN'] = '1'
        env['ARCH'] = 'x86_64'
        runtime = cached_tool(RUNTIME)
        subprocess.run([str(binary), '--no-appstream', '--runtime-file', str(runtime), str(appdir), str(output)], check=True, env=env)
    if not output.is_file() or output.stat().st_size < 1024:
        raise ValueError('AppImage não foi gerado')
    header = output.read_bytes()[:11]
    if header[:4] != b'\x7fELF' or header[8:11] != b'AI\x02':
        raise ValueError('O arquivo gerado não é um AppImage tipo 2')
    return {'file': str(output), 'version': version, 'bytes': output.stat().st_size}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--tool', type=Path, help='appimagetool já baixado. Sem este argumento, a versão 1.9.1 é baixada e conferida.')
    args = parser.parse_args()
    try:
        print(build(args.source, args.output, args.tool))
    except (ValueError, subprocess.CalledProcessError, OSError) as error:
        print(str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
