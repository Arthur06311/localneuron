import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('sums', Path(__file__).resolve().parents[1] / 'scripts/sha256sums.py')
sums = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sums)


class Sha256SumsTest(unittest.TestCase):
    def test_writes_gnu_sums_for_every_artifact_except_itself(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            first = root / 'LocalNeuron-Linux-x64.AppImage'
            second = root / 'LocalNeuron-Windows-x64-Setup.exe'
            first.write_bytes(b'linux')
            second.write_bytes(b'windows')
            output = root / 'SHA256SUMS.txt'
            lines = sums.write_sums([second, first], output)
            self.assertEqual(lines, [
                f'{hashlib.sha256(b"linux").hexdigest()}  LocalNeuron-Linux-x64.AppImage',
                f'{hashlib.sha256(b"windows").hexdigest()}  LocalNeuron-Windows-x64-Setup.exe',
            ])
            self.assertEqual(output.read_text(encoding='utf-8'), '\n'.join(lines) + '\n')

    def test_rejects_an_empty_artifact(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            empty = root / 'LocalNeuron-Linux-x64.AppImage'
            empty.write_bytes(b'')
            with self.assertRaisesRegex(ValueError, 'vazio'):
                sums.write_sums([empty], root / 'SHA256SUMS.txt')


if __name__ == '__main__':
    unittest.main()
