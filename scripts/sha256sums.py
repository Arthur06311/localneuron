#!/usr/bin/env python3
"""Write GNU-style SHA256SUMS.txt for release artifacts."""
import argparse
import hashlib
from pathlib import Path
import sys


def write_sums(paths, output):
    files = [path.resolve() for path in paths]
    output = output.resolve()
    if not files:
        raise ValueError('Nenhum artefato para somar')
    names = [path.name for path in files]
    if len(names) != len(set(names)):
        raise ValueError('Há artefatos com o mesmo nome')
    if output in files:
        raise ValueError('SHA256SUMS.txt não entra na própria soma')
    lines = []
    for path in sorted(files, key=lambda item: item.name):
        if not path.is_file() or path.is_symlink() or path.stat().st_size == 0:
            raise ValueError('Artefato vazio ou inválido: ' + path.name)
        if '\n' in path.name or path.name.startswith('-') or path.name == 'SHA256SUMS.txt':
            raise ValueError('Nome de artefato inválido: ' + path.name)
        with path.open('rb') as stream:
            digest = hashlib.file_digest(stream, 'sha256').hexdigest()
        lines.append(f'{digest}  {path.name}')
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    return lines


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('files', nargs='+', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    try:
        for line in write_sums(args.files, args.output):
            print(line)
    except ValueError as error:
        print(str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
