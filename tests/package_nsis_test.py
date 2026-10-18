import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('nsis', ROOT / 'scripts/package-nsis.py')
nsis = importlib.util.module_from_spec(spec)
spec.loader.exec_module(nsis)


def fixture(root):
    source = root / 'LocalNeuron-win32-x64'
    for name in ['LocalNeuron.exe', 'v8_context_snapshot.bin', 'snapshot_blob.bin', 'resources/app/dist/src/server.js']:
        path = source / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b'MZfixture' if name.endswith('.exe') else b'fixture')
    (source / 'resources/app/package.json').write_text(json.dumps({'version': '0.27.0'}), encoding='utf-8')
    (source / 'resources/app/subscription-config.json').write_text(json.dumps({'serviceUrl': None, 'publicKey': None}), encoding='utf-8')
    return source


class NsisTest(unittest.TestCase):
    def test_script_does_not_sign(self):
        text = (ROOT / 'packaging/windows/localneuron.nsi').read_text(encoding='utf-8')
        code = '\n'.join(line.split(';', 1)[0] for line in text.splitlines())
        self.assertNotIn('signtool', code.lower())
        self.assertIn('Não assina', text)
        self.assertIn('signtool', text.lower())
        header = nsis.render_header('0.27.0', Path('/tmp/LocalNeuron-win32-x64'), Path('/tmp/LocalNeuron-Windows-x64-Setup.exe'), 12)
        self.assertIn('!define VERSION "0.27.0"', header)
        self.assertIn('!define VERSION4 "0.27.0.0"', header)
        self.assertNotIn('SIGN', header)

    def test_real_installer_is_an_unsigned_pe(self):
        if shutil.which('makensis') is None:
            self.skipTest('makensis ausente')
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            output = root / 'LocalNeuron-Windows-x64-Setup.exe'
            result = nsis.build(fixture(root), output)
            data = output.read_bytes()
            self.assertEqual(data[:2], b'MZ')
            self.assertGreater(result['bytes'], 1024)
            self.assertNotIn(b'signtool', data.lower())


if __name__ == '__main__':
    unittest.main()
