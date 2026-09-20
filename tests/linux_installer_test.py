"""Exercise the real installer in a temporary HOME on Linux; never launch Electron."""
import importlib.util
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('package_linux', ROOT / 'scripts/package-linux.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)

@unittest.skipUnless(platform.system() == 'Linux' and os.getuid() != 0, 'Requires Linux, non-root user')
class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / 'bundle'
        for name in builder.REQUIRED:
            path = self.source / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text('fixture ' + name)
        self.binary = self.source / 'LocalNeuron'
        self.binary.write_text('#!/bin/sh\nprintf "started\\n" > "$HOME/launched"\n')
        self.binary.chmod(0o755)
        (self.source / 'resources/app/package.json').write_text(json.dumps({'version':'0.27.0'}))
        (self.source / 'resources/app/subscription-config.json').write_text(json.dumps({'serviceUrl':None,'publicKey':None}))
        self.home = self.root / 'home space'
        self.home.mkdir()
        self.data = self.home / 'custom data'
        self.env = {**os.environ, 'HOME':str(self.home), 'XDG_DATA_HOME':str(self.data), 'XDG_STATE_HOME':str(self.home / 'state'), 'DISPLAY':':999'}
        self.installer = self.root / 'installer with spaces.run'
        self.arch = 'x64' if platform.machine() == 'x86_64' else 'arm64'
        builder.build(self.source, self.installer, self.arch)

    def run_installer(self, path=None, *args, ok=True, env=None):
        result = subprocess.run(['bash', str(path or self.installer), *args], env=env or self.env, text=True, capture_output=True)
        if ok:
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        else:
            self.assertNotEqual(result.returncode, 0, result.stdout)
        return result

    def test_install_reinstall_launch_and_preserve_user_data(self):
        vault = self.home / '.config/Colmeia/workspace/vault.enc.json'
        vault.parent.mkdir(parents=True)
        vault.write_text('existing user data')
        self.run_installer(None, '--check')
        self.assertFalse(self.data.exists())
        self.run_installer()
        base = self.data / 'localneuron'
        first = (base / 'current').resolve()
        self.assertTrue((first / 'v8_context_snapshot.bin').is_file())
        self.assertTrue((self.data / 'applications/localneuron.desktop').is_file())
        result = subprocess.run([str(base / 'start')], env=self.env, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.home / 'launched').read_text(), 'started\n')
        self.run_installer()
        self.assertEqual((base / 'current').resolve(), first)
        self.assertEqual(len(list((base / 'versions').iterdir())), 1)
        self.assertEqual(vault.read_text(), 'existing user data')

    def test_truncated_download_never_publishes(self):
        self.installer.write_bytes(self.installer.read_bytes()[:-50])
        result = self.run_installer(ok=False)
        self.assertIn('Download incompleto', result.stderr)
        self.assertFalse((self.data / 'localneuron/current').exists())
        self.assertFalse((self.data / 'applications/localneuron.desktop').exists())
        self.assertEqual(list((self.data / 'localneuron').glob('.install-*')), [])

    def test_corrupt_payload_preserves_current(self):
        self.run_installer()
        before = (self.data / 'localneuron/current').resolve()
        content = bytearray(self.installer.read_bytes()); content[-20] ^= 1
        self.installer.write_bytes(content)
        result = self.run_installer(ok=False)
        self.assertIn('SHA-256', result.stderr)
        self.assertEqual((self.data / 'localneuron/current').resolve(), before)

    def test_missing_snapshot_refused_at_build_time(self):
        (self.source / 'v8_context_snapshot.bin').unlink()
        with self.assertRaisesRegex(ValueError, 'v8_context_snapshot'):
            builder.build(self.source, self.installer, self.arch)

    def test_snapshot_corruption_blocked_before_electron(self):
        self.run_installer()
        base = self.data / 'localneuron'
        (base / 'current/v8_context_snapshot.bin').write_text('broken')
        env = {**self.env, 'DISPLAY':'', 'WAYLAND_DISPLAY':''}
        result = subprocess.run([str(base / 'start')], env=env, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse((self.home / 'launched').exists())
        self.assertIn('inicialização', result.stderr)

    def test_interrupted_extraction_preserves_previous_install(self):
        self.run_installer()
        before = (self.data / 'localneuron/current').resolve()
        shims = self.root / 'bin'; shims.mkdir()
        shim = shims / 'tar'; shim.write_text('#!/bin/sh\nexit 42\n'); shim.chmod(0o755)
        self.run_installer(ok=False, env={**self.env, 'PATH':str(shims)+':'+self.env['PATH']})
        self.assertEqual((self.data / 'localneuron/current').resolve(), before)
        self.assertEqual(list((self.data / 'localneuron').glob('.install-*')), [])

    def test_upgrade_publishes_complete_version_and_keeps_old(self):
        self.run_installer()
        before = (self.data / 'localneuron/current').resolve()
        (self.source / 'resources/app/package.json').write_text(json.dumps({'version':'0.27.1'}))
        builder.build(self.source, self.installer, self.arch)
        self.run_installer()
        current = (self.data / 'localneuron/current').resolve()
        self.assertNotEqual(current, before)
        self.assertTrue(before.is_dir())
        self.assertTrue((current / 'v8_context_snapshot.bin').is_file())

    def test_external_symlink_refused(self):
        (self.source / 'outside').symlink_to('/etc/passwd')
        with self.assertRaisesRegex(ValueError, 'Link fora'):
            builder.build(self.source, self.installer, self.arch)

    def test_competing_installer_refused(self):
        import fcntl
        base = self.data / 'localneuron'; base.mkdir(parents=True)
        with (base / 'install.lock').open('w') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            result = self.run_installer(ok=False)
            self.assertIn('Outra instalação', result.stderr)
            self.assertFalse((base / 'current').exists())

if __name__ == '__main__':
    unittest.main(verbosity=2)
