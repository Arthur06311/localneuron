#!/usr/bin/env python3
"""Wrap the verified .run in a ZIP with a clickable desktop installer."""
import argparse
import hashlib
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent.parent

def exec_arg(value):
    # Desktop string escaping is applied after Exec argument quoting.
    quoted = value.replace('\\', '\\\\').replace('"', '\\"').replace('`', '\\`').replace('$', '\\$')
    return '"' + quoted.replace('\\', '\\\\') + '"'

def build(installer, output, arch):
    expected = f'LocalNeuron-Linux-{arch}.run'
    if installer.name != expected or not installer.is_file():
        raise ValueError('Installer ausente ou nome inválido: ' + expected)
    folder = 'LocalNeuron-Instalar'
    command = 'exec bash "$(dirname -- "$1")/install-gui.sh"'
    desktop = '\n'.join([
        '[Desktop Entry]', 'Version=1.0', 'Type=Application',
        'Name=Instalar LocalNeuron', 'Comment=Instala e abre o LocalNeuron automaticamente',
        'Exec=bash -c ' + exec_arg(command) + ' localneuron-installer %k',
        'Icon=system-software-install', 'Terminal=false', 'Categories=Utility;',
        'StartupNotify=false', '',
    ])
    instructions = '''LOCALNEURON · INSTALAÇÃO AUTOMÁTICA (LINUX)

1. Extraia este ZIP e aguarde terminar.
2. Abra a pasta LocalNeuron-Instalar.
3. Dê dois cliques em “Instalar LocalNeuron”.
4. Aguarde: o aplicativo será instalado e aberto automaticamente.

O gerenciador de arquivos pode pedir “Permitir executar” ou “Confiar e iniciar”.
Essa é uma confirmação do Linux. Não é necessário digitar comandos ou usar sudo.
Se os scripts forem abertos como texto, use o arquivo “Instalar LocalNeuron.desktop”.

Com Zenity, uma janela mostra o andamento. Sem Zenity, um terminal gráfico
compatível executa a instalação por você, sem comandos para digitar.
Para cancelar, use Cancelar na janela ou feche o terminal de instalação.

Se ocorrer erro, o aplicativo não é iniciado. Os detalhes ficam em
~/.local/state/localneuron/ (ou XDG_STATE_HOME). Modelos e conversas são preservados.
O instalador não configura inicialização automática ao ligar o computador.
Após instalar, use o atalho LocalNeuron no menu de aplicativos.

Alfa: instalador e backend verificados em Linux x64 isolado;
a interface gráfica em uma máquina Omarchy física ainda precisa de validação.
'''
    output.parent.mkdir(parents=True, exist_ok=True)
    part = output.with_suffix(output.suffix + '.part')
    try:
        with zipfile.ZipFile(part, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
            # Write the payload first and clickable entry last: no half-extracted app launch.
            info = zipfile.ZipInfo(folder + '/' + expected)
            info.create_system = 3; info.external_attr = 0o100755 << 16
            with installer.open('rb') as source, archive.open(info, 'w', force_zip64=True) as destination:
                import shutil
                shutil.copyfileobj(source, destination)
            for name, content, mode in [
                ('install-gui.sh', (ROOT/'packaging/linux/install-gui.sh').read_text().replace('@ARCH@', arch), 0o755),
                ('LEIA-ME.txt', instructions, 0o644),
                ('Instalar LocalNeuron.desktop', desktop, 0o755),
            ]:
                info = zipfile.ZipInfo(folder + '/' + name)
                info.create_system = 3; info.external_attr = (0o100000 | mode) << 16
                info.compress_type = zipfile.ZIP_DEFLATED
                archive.writestr(info, content)
        part.replace(output)
    finally:
        part.unlink(missing_ok=True)
    with output.open('rb') as stream:
        digest = hashlib.file_digest(stream, 'sha256').hexdigest()
    output.with_suffix(output.suffix+'.sha256').write_text(f'{digest}  {output.name}\n')
    print(f'{output}: {output.stat().st_size} bytes · SHA-256 {digest}')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('installer', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--arch', choices=['x64','arm64'], default='x64')
    args=parser.parse_args(); build(args.installer,args.output,args.arch)
