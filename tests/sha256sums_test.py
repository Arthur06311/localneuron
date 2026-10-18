import hashlib
from pathlib import Path
import tempfile
import unittest

import importlib.util

spec = importlib.util.spec_from_file_location('sha256sums', Path(__file__).resolve().parents[1] / 'scripts/sha256sums.py')
sums = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sums)


class Sha256SumsTest(unittest.TestCase):
    def test_gnu_format_and_stable_order(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            first = root / 'b.bin'
            second = root / 'a.bin'
            first.write_bytes(b'one')
            second.write_bytes(b'two')
            output = root / 'SHA256SUMS'
            lines = sums.write_sums([first, second], output)
            self.assertEqual(lines, [
                hashlib.sha256(b'two').hexdigest() + '  a.bin',
                hashlib.sha256(b'one').hexdigest() + '  b.bin',
            ])
            self.assertEqual(output.read_text(encoding='utf-8'), '\n'.join(lines) + '\n')

    def test_refuses_to_hash_itself_or_an_empty_file(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            artifact = root / 'SHA256SUMS'
            artifact.write_bytes(b'x')
            with self.assertRaisesRegex(ValueError, 'inválido'):
                sums.write_sums([artifact], root / 'out')
            empty = root / 'vazio.bin'
            empty.write_bytes(b'')
            with self.assertRaisesRegex(ValueError, 'vazio'):
                sums.write_sums([empty], root / 'SHA256SUMS')


if __name__ == '__main__':
    unittest.main()
