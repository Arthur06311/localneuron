#!/usr/bin/env python3
"""Wrap an Electron Packager Windows directory as an unsigned NSIS installer."""
import argparse
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parent))
import release_bundle

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / 'packaging/windows/localneuron.nsi'
NUMERIC_VERSION = re.compile(r'^(\d+\.\d+\.\d+)(?:-.+)?$')


def version_fields(version):
    match = NUMERIC_VERSION.fullmatch(version)
    if not match:
        raise ValueError('Versão inválida para o instalador')
    return version, match.group(1) + '.0'


def nsis_string(value):
    if any(char in value for char in '"\r\n$`'):
        raise ValueError('Caminho incompatível com o NSIS')
    return value.replace('\\', '/')


def render_header(version, source, output, estimated_kib):
    full, numeric = version_fields(version)
    source_text = nsis_string(str(Path(source).resolve()))
    output_text = nsis_string(str(Path(output).resolve()))
    return '\n'.join([
        f'!define VERSION "{full}"',
        f'!define VERSION4 "{numeric}"',
        f'!define SOURCE "{source_text}"',
        f'!define OUTFILE "{output_text}"',
        f'!define ESTIMATED_SIZE {estimated_kib}',
        '',
    ])


def find_makensis():
    found = shutil.which('makensis')
    if found:
        return found
    for candidate in (Path(r'C:\Program Files (x86)\NSIS\makensis.exe'), Path(r'C:\Program Files\NSIS\makensis.exe')):
        if candidate.is_file():
            return str(candidate)
    raise ValueError('makensis não está no PATH. Instale o NSIS. No workflow de release o Windows instala o NSIS sem certificado e sem signtool.')


def estimated_kib(source):
    total = sum(path.stat().st_size for path in source.rglob('*') if path.is_file() and not path.is_symlink())
    return max(1, total // 1024)


def build(source, output, makensis=None):
    source = Path(source).resolve()
    output = Path(output).resolve()
    version = release_bundle.validate_bundle(source, release_bundle.WINDOWS_FILES, 'LocalNeuron.exe')
    output.parent.mkdir(parents=True, exist_ok=True)
    compiler = makensis or find_makensis()
    with tempfile.TemporaryDirectory(prefix='localneuron-nsis-') as temporary:
        script = Path(temporary) / 'localneuron-build.nsi'
        script.write_text(render_header(version, source, output, estimated_kib(source)) + f'!include "{nsis_string(str(TEMPLATE))}"\n', encoding='utf-8')
        subprocess.run([compiler, '-INPUTCHARSET', 'UTF8', str(script)], check=True)
    if not output.is_file() or output.stat().st_size < 1024 or output.read_bytes()[:2] != b'MZ':
        raise ValueError('O instalador NSIS não foi gerado')
    return {'file': str(output), 'version': version, 'bytes': output.stat().st_size}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    try:
        print(build(args.source, args.output))
    except (ValueError, subprocess.CalledProcessError, OSError) as error:
        print(str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
