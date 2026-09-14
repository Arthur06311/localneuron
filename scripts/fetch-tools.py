#!/usr/bin/env python3
"""Fetch pinned open-source auxiliary engines; build whisper.cpp on Apple Silicon."""
from pathlib import Path
import hashlib,json,sys,platform,tempfile,urllib.request,zipfile,tarfile,subprocess,shutil,os
root=Path(__file__).resolve().parents[1]
target=sys.argv[1] if len(sys.argv)>1 else {'Darwin':'darwin-arm64','Windows':'win32-x64','Linux':'linux-x64'}[platform.system()]
manifest=json.loads((root/'runtime/tools-manifest.json').read_text())
def fetch(asset,path):
    urllib.request.urlretrieve(asset['url'],path)
    if path.stat().st_size!=asset['bytes'] or hashlib.file_digest(path.open('rb'),'sha256').hexdigest()!=asset['sha256']:
        raise RuntimeError('Engine archive failed SHA-256 verification')
def extract(path,dest):
    if zipfile.is_zipfile(path):
        with zipfile.ZipFile(path) as z:
            for entry in z.infolist():
                if not (dest/entry.filename).resolve().is_relative_to(dest.resolve()):raise RuntimeError('Unsafe archive path')
            z.extractall(dest)
    else:
        with tarfile.open(path) as t:t.extractall(dest,filter='data')
for name,engine in manifest['engines'].items():
    asset=engine['assets'].get(target)
    if not asset:raise SystemExit('Unsupported engine platform: '+target)
    output=root/'runtime'/('tools-'+target)/name
    marker=output/'.engine-sha256'
    identity=hashlib.sha256(json.dumps(engine,sort_keys=True).encode()).hexdigest()
    if (root/'runtime'/asset['binary']).exists() and marker.exists() and marker.read_text()==identity:
        print(name+': pinned runtime ready');continue
    with tempfile.TemporaryDirectory(prefix='localneuron-engine-') as tmp:
        tmp=Path(tmp);stage=tmp/'stage';stage.mkdir()
        archive=tmp/'archive';fetch(engine['source_archive'] if asset.get('build_from_source') else asset,archive)
        if asset.get('build_from_source'):
            if platform.system()!='Darwin' or platform.machine()!='arm64':raise SystemExit('Build the Mac whisper engine on Apple Silicon')
            source=tmp/'source';source.mkdir();extract(archive,source);source=next(source.iterdir());build=tmp/'build'
            subprocess.run(['cmake','-S',str(source),'-B',str(build),'-DCMAKE_BUILD_TYPE=Release','-DBUILD_SHARED_LIBS=OFF','-DGGML_METAL_EMBED_LIBRARY=ON','-DWHISPER_BUILD_TESTS=OFF','-DGGML_NATIVE=OFF','-DCMAKE_OSX_DEPLOYMENT_TARGET=14.0'],check=True)
            subprocess.run(['cmake','--build',str(build),'--target','whisper-cli','-j',str(min(6,os.cpu_count() or 2))],check=True)
            shutil.copy2(build/'bin/whisper-cli',stage/'whisper-cli');shutil.copy2(source/'LICENSE',stage/'LICENSE')
        else:extract(archive,stage)
        relative=Path(asset['binary']).relative_to(Path('tools-'+target)/name)
        binary=stage/relative
        if not binary.is_file():raise RuntimeError('Engine binary missing from archive')
        if not target.startswith('win32'):binary.chmod(0o755)
        (stage/'.engine-sha256').write_text(identity)
        output.parent.mkdir(parents=True,exist_ok=True)
        if output.exists():shutil.rmtree(output)
        shutil.copytree(stage,output,symlinks=True)
        print(name+': installed and verified')
