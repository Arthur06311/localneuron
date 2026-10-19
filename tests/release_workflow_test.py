from pathlib import Path
import unittest

WORKFLOW = Path(__file__).resolve().parents[1] / '.github/workflows/release.yml'


class ReleaseWorkflowTest(unittest.TestCase):
    def test_draft_release_lists_every_artifact_and_defers_signing(self):
        text = WORKFLOW.read_text(encoding='utf-8')
        self.assertIn('tags:\n      - "v*"', text)
        self.assertIn('pull_request:', text)
        self.assertIn('.github/workflows/release.yml', text)
        self.assertIn('scripts/package-*', text)
        self.assertIn('packaging/**', text)
        self.assertIn('workflow_dispatch:', text)
        self.assertIn("if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')", text)
        self.assertIn('--draft', text)
        self.assertIn('--dist-only', text)
        self.assertIn('node node_modules/electron/install.js', text)
        self.assertIn('node_modules/electron/dist/Electron.app', text)
        self.assertLess(text.index('node node_modules/electron/install.js'), text.index('scripts/package-macos.py'))
        self.assertIn('flat/SHA256SUMS.txt', text)
        for name in [
            'LocalNeuron-macOS-arm64.dmg',
            'LocalNeuron-macOS-arm64.zip',
            'LocalNeuron-Linux-x64.deb',
            'LocalNeuron-Linux-x64.pkg.tar.gz',
            'LocalNeuron-Linux-x64.AppImage',
            'LocalNeuron-Windows-x64-Setup.exe',
        ]:
            self.assertIn(name, text)
        self.assertIn('a cargo do Arthur', text)
        self.assertIn('notarytool', text)
        for line in text.splitlines():
            code = line.split('#', 1)[0].lower()
            self.assertNotIn('signtool', code)
            self.assertNotIn('notarytool', code)
            self.assertNotIn('xcrun', code)
        self.assertNotIn('secrets.', text)
        self.assertNotIn('git tag', text)
        self.assertNotIn('electron-builder', text.lower())
        self.assertNotIn('electron-forge', text.lower())


if __name__ == '__main__':
    unittest.main()
