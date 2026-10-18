import importlib.util
import json
import shutil
from pathlib import Path
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
    def test_header_has_version_and_no_signing(self):
        header = nsis.render_header('0.28.0-alpha.1', Path('/tmp/src'), Path('/tmp/out/Setup.exe'), 12)
        self.assertIn('!define VERSION "0.28.0-alpha.1"', header)
        self.assertIn('!define VERSION4 "0.28.0.0"', header)
        self.assertNotIn('SignTool', header)
        script = (ROOT / 'packaging/windows/localneuron.nsi').read_text(encoding='utf-8')
        self.assertNotIn('signtool', script.lower())
        self.assertIn('PortugueseBR', script)

    def test_missing_executable_is_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            source = fixture(Path(temporary))
            (source / 'LocalNeuron.exe').unlink()
            with self.assertRaisesRegex(ValueError, 'incompleto'):
                nsis.build(source, Path(temporary) / 'LocalNeuron-Windows-x64-Setup.exe', 'makensis')

    @unittest.skipUnless(shutil.which('makensis'), 'makensis ausente')
    def test_makensis_builds_an_unsigned_installer(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            output = root / 'LocalNeuron-Windows-x64-Setup.exe'
            result = nsis.build(fixture(root), output)
            data = output.read_bytes()
            self.assertEqual(data[:2], b'MZ')
            self.assertGreater(result['bytes'], 1024)
            self.assertNotIn(b'SignTool', data)


if __name__ == '__main__':
    unittest.main()
