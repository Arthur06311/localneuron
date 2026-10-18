import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('appimage', ROOT / 'scripts/package-appimage.py')
appimage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(appimage)


def fixture(root):
    source = root / 'LocalNeuron-linux-x64'
    required = [
        'LocalNeuron', 'chrome-sandbox', 'v8_context_snapshot.bin', 'snapshot_blob.bin',
        'icudtl.dat', 'resources.pak', 'chrome_100_percent.pak', 'chrome_200_percent.pak',
        'resources/app/dist/src/server.js', 'resources/app/public/app-icon.png',
    ]
    for name in required:
        path = source / name
        path.parent.mkdir(parents=True, exist_ok=True)
        if name == 'resources/app/public/app-icon.png':
            shutil.copyfile(ROOT / 'public/app-icon.png', path)
        elif name == 'LocalNeuron':
            path.write_text('#!/bin/sh\necho localneuron-ok\n', encoding='utf-8')
            path.chmod(0o755)
        else:
            path.write_text('fixture', encoding='utf-8')
    (source / 'resources/app/package.json').write_text(json.dumps({'version': '0.27.0'}), encoding='utf-8')
    (source / 'resources/app/subscription-config.json').write_text(json.dumps({'serviceUrl': None, 'publicKey': None}), encoding='utf-8')
    return source


class AppImageTest(unittest.TestCase):
    def test_appdir_keeps_the_packager_binary_and_rejects_a_secret(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = fixture(root)
            appdir = root / 'LocalNeuron.AppDir'
            self.assertEqual(appimage.prepare_appdir(source, appdir), '0.27.0')
            self.assertIn('Exec=LocalNeuron', (appdir / 'localneuron.desktop').read_text(encoding='utf-8'))
            self.assertNotIn('--no-sandbox', (appdir / 'AppRun').read_text(encoding='utf-8'))
            self.assertTrue(os.access(appdir / 'AppRun', os.X_OK))
            (source / 'resources/app/secret.pem').write_text('secret', encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'segredo'):
                appimage.prepare_appdir(source, root / 'rejected.AppDir')

    def test_external_symlink_is_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            source = fixture(Path(temporary))
            (source / 'outside').symlink_to('/tmp')
            with self.assertRaisesRegex(ValueError, 'Link fora'):
                appimage.prepare_appdir(source, Path(temporary) / 'LocalNeuron.AppDir')

    @unittest.skipUnless(sys.platform == 'linux', 'o AppImage de teste só executa no Linux')
    def test_real_appimage_runs_the_packaged_binary(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            output = root / 'LocalNeuron-Linux-x64.AppImage'
            result = appimage.build(fixture(root), output)
            self.assertGreater(result['bytes'], 1024)
            env = os.environ.copy()
            env['APPIMAGE_EXTRACT_AND_RUN'] = '1'
            completed = subprocess.run([str(output)], check=True, capture_output=True, text=True, env=env)
            self.assertIn('localneuron-ok', completed.stdout)


if __name__ == '__main__':
    unittest.main()
