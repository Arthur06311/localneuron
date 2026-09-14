#!/usr/bin/env python3
"""Verify pinned catalogue metadata against HF without downloading model weights.
Run npm run build first. No tokens required; no user data is read.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import json, subprocess, urllib.request
root=Path(__file__).resolve().parents[1]
models=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {CATALOG} from './dist/src/catalog.js';console.log(JSON.stringify(CATALOG))"],cwd=root))
def verify(m):
    url=f"https://huggingface.co/api/models/{m['repo']}/revision/{m['revision']}?blobs=true"
    d=json.load(urllib.request.urlopen(url,timeout=60))
    assert d['sha']==m['revision'],m['id']
    files={f['rfilename']:f for f in d['siblings']}
    for p in m.get('parts',[m]):
        f=files[p.get('path',p['file'])]
        assert f['size']==p['bytes'] and f['lfs']['sha256']==p['sha256'],(m['id'],p['file'])
    return m['id']
if __name__=='__main__':
    with ThreadPoolExecutor(max_workers=4) as pool:
        verified=list(pool.map(verify,models))
    print(f'{len(verified)} modelos: commits, tamanhos e SHA-256 publicados conferidos. Pesos não baixados.')
