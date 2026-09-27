import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('native', Path(__file__).resolve().parents[1] / 'scripts/package-linux-native.py')
native = importlib.util.module_from_spec(spec)
spec.loader.exec_module(native)

class NativePackageTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / 'source'
        for name in ['LocalNeuron', 'chrome-sandbox', 'v8_context_snapshot.bin', 'snapshot_blob.bin', 'resources/app/dist/src/server.js', 'launch.sh', 'startup.sha256']:
            path = self.source / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text('fixture')
        (self.source / 'resources/app/package.json').write_text(json.dumps({'version': '0.27.0'}))
        (self.source / 'LocalNeuron').chmod(0o777)

    def test_native_packages_have_root_owned_non_writable_parents_and_setuid_helper(self):
        output = self.root / 'out'
        native.build(self.source, output)
        data = (output / 'LocalNeuron-Linux-x64.deb').read_bytes()
        self.assertEqual(data[:8], b'!<arch>\n')
        members = {}
        pos = 8
        while pos < len(data):
            header = data[pos:pos + 60]
            size = int(header[48:58])
            members[header[:16].decode().strip().rstrip('/')] = data[pos + 60:pos + 60 + size]
            pos += 60 + size + size % 2
        self.assertEqual(members['debian-binary'], b'2.0\n')
        for archive in [io.BytesIO(members['data.tar.gz']), output / 'LocalNeuron-Linux-x64.pkg.tar.gz']:
            with tarfile.open(fileobj=archive, mode='r:gz') if isinstance(archive, io.BytesIO) else tarfile.open(archive, 'r:gz') as tar:
                for entry in tar:
                    self.assertEqual((entry.uid, entry.gid), (0, 0))
                    self.assertFalse(entry.mode & 0o022, entry.name)
                    self.assertEqual(entry.mode & 0o6000, 0o4000 if entry.name.endswith('/chrome-sandbox') else 0)
                self.assertEqual(tar.getmember('opt/localneuron/chrome-sandbox').mode, 0o4755)
                self.assertEqual(tar.getmember('opt/localneuron').mode, 0o755)
        with tarfile.open(fileobj=io.BytesIO(members['data.tar.gz']), mode='r:gz') as tar:
            profile = tar.extractfile('etc/apparmor.d/localneuron').read().decode()
            self.assertIn('/opt/localneuron/LocalNeuron', profile)
            self.assertNotIn('**', profile)

    def test_external_symlink_is_rejected(self):
        (self.source / 'outside').symlink_to('/tmp')
        with self.assertRaisesRegex(ValueError, 'Link externo'):
            native.build(self.source, self.root / 'out')

    def test_missing_snapshot_is_rejected(self):
        (self.source / 'v8_context_snapshot.bin').unlink()
        with self.assertRaisesRegex(ValueError, 'incompleto'):
            native.build(self.source, self.root / 'out')

if __name__ == '__main__':
    unittest.main()
