#!/usr/bin/env python3
"""Bundle a pinned standalone Node runtime: Electron disallows external N-API buffers."""
from pathlib import Path
import hashlib,json,sys,tempfile,urllib.request,zipfile,tarfile,shutil
root=Path(__file__).resolve().parents[1]
target=sys.argv[1]
manifest=json.loads((root/'runtime/voice-node-manifest.json').read_text())
asset=manifest['assets'].get(target)
if not asset:raise SystemExit('Unsupported voice runtime: '+target)
output=root/'runtime'/('voice-node-'+target)
binary='node.exe' if target.startswith('win32') else 'node'
marker=output/'.sha256'
if (output/binary).exists() and marker.exists() and marker.read_text()==asset['sha256']:
 print('Pinned voice Node runtime ready: '+target);raise SystemExit(0)
with tempfile.TemporaryDirectory(prefix='localneuron-voice-node-') as d:
 d=Path(d);archive=d/'archive';urllib.request.urlretrieve(asset['url'],archive)
 if hashlib.file_digest(archive.open('rb'),'sha256').hexdigest()!=asset['sha256']:raise RuntimeError('Node runtime checksum mismatch')
 stage=d/'stage';stage.mkdir();prefix=asset['prefix']
 names={binary:prefix+('/node.exe' if binary.endswith('.exe') else '/bin/node'),'LICENSE':prefix+'/LICENSE'}
 if zipfile.is_zipfile(archive):
  with zipfile.ZipFile(archive) as z:
   for dest,source in names.items():(stage/dest).write_bytes(z.read(source))
 else:
  with tarfile.open(archive) as t:
   for dest,source in names.items():(stage/dest).write_bytes(t.extractfile(source).read())
 (stage/binary).chmod(0o755);(stage/'.sha256').write_text(asset['sha256'])
 if output.exists():shutil.rmtree(output)
 shutil.copytree(stage,output)
 print('Pinned voice Node installed: '+target)
