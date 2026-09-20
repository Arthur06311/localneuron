"""Graphical installer orchestration tests; GUI dialogs are controlled test doubles."""
import importlib.util
import os
from pathlib import Path
import platform
import shutil
import subprocess
import tempfile
import sys
import time
import unittest
import zipfile

ROOT = Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('gui_builder',ROOT/'scripts/package-linux-gui.py')
builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)

@unittest.skipUnless(platform.system()=='Linux' and os.getuid()!=0,'Requires non-root Linux')
class GuiTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name);self.home=self.root/'home space';self.home.mkdir()
        self.bin=self.root/'bin';self.bin.mkdir()
        self.env={**os.environ,'HOME':str(self.home),'XDG_DATA_HOME':str(self.home/'data'),'XDG_STATE_HOME':str(self.home/'state'),'DISPLAY':':999','PATH':str(self.bin)+':'+os.environ['PATH']}
        self.installer=self.root/'LocalNeuron-Linux-x64.run'
        self.installer.write_text('''#!/usr/bin/env bash
set -eu
[ "${1:-}" = --install ]
sleep "${INSTALL_DELAY:-0.2}"
if [ "${FAIL_INSTALL:-0}" = 1 ]; then echo 'Download incompleto' >&2; exit 7; fi
mkdir -p "$XDG_DATA_HOME/localneuron"
cat > "$XDG_DATA_HOME/localneuron/start" <<'SCRIPT'
#!/bin/sh
printf 'opened' > "$HOME/opened"
SCRIPT
chmod +x "$XDG_DATA_HOME/localneuron/start"
echo done > "$HOME/installed"
''')
        self.installer.chmod(0o755)
        self.zip=self.root/'installer.zip';builder.build(self.installer,self.zip,'x64')
        # Names with spaces, quotes, dollar, percent and parentheses exercise Exec escaping.
        self.extract=self.root/'folder (1) "quote" $cash % extra'
        with zipfile.ZipFile(self.zip) as archive: archive.extractall(self.extract)
        self.folder=self.extract/'LocalNeuron-Instalar'
        self.script=self.folder/'install-gui.sh'
        self.desktop=self.folder/'Instalar LocalNeuron.desktop'
        self.zenity=self.bin/'zenity'
        self.zenity.write_text('''#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$HOME/dialogs"
case "$1" in
 --progress) if [ "${CANCEL_INSTALL:-0}" = 1 ]; then exit 1; fi; cat >/dev/null ;;
 --error) exit 0 ;;
esac
''');self.zenity.chmod(0o755)

    def wait_for(self,path):
        for _ in range(50):
            if path.exists(): return
            time.sleep(.1)
        self.fail('Missing file: '+str(path))

    def run_gui(self,*args,**env):
        return subprocess.run(['bash',str(self.script),*args],env={**self.env,**env},text=True,capture_output=True,timeout=12)

    def test_success_installs_then_opens(self):
        result=self.run_gui();self.assertEqual(result.returncode,0,result.stderr)
        self.assertTrue((self.home/'installed').exists());self.wait_for(self.home/'opened')
        self.assertIn('--progress',(self.home/'dialogs').read_text())

    def test_failure_never_launches(self):
        result=self.run_gui(FAIL_INSTALL='1');self.assertEqual(result.returncode,7)
        self.assertFalse((self.home/'opened').exists());self.assertIn('--error',(self.home/'dialogs').read_text())

    def test_cancel_stops_worker_and_does_not_launch(self):
        result=self.run_gui(CANCEL_INSTALL='1',INSTALL_DELAY='1');self.assertEqual(result.returncode,130,result.stderr)
        time.sleep(1.3)
        self.assertFalse((self.home/'installed').exists());self.assertFalse((self.home/'opened').exists())

    def test_missing_payload_fails_cleanly(self):
        (self.folder/'LocalNeuron-Linux-x64.run').unlink()
        result=self.run_gui();self.assertNotEqual(result.returncode,0);self.assertIn('Extraia',result.stderr)

    def test_terminal_mode_is_automatic(self):
        result=self.run_gui('--terminal');self.assertEqual(result.returncode,0,result.stderr)
        self.wait_for(self.home/'opened')

    def test_no_display_does_not_install(self):
        result=self.run_gui(DISPLAY='',WAYLAND_DISPLAY='');self.assertNotEqual(result.returncode,0)
        self.assertFalse((self.home/'installed').exists())

    @unittest.skipIf(shutil.which('zenity'), 'Fallback requires no system Zenity')
    def test_graphical_terminal_fallback_needs_no_typed_command(self):
        self.zenity.unlink()
        terminal=self.bin/'alacritty'
        terminal.write_text('#!/bin/sh\n[ "$1" = -e ] || exit 5\nshift\nexec "$@"\n')
        terminal.chmod(0o755)
        result=self.run_gui();self.assertEqual(result.returncode,0,result.stderr)
        self.wait_for(self.home/'opened')

    def test_zip_permissions_and_payload_order(self):
        with zipfile.ZipFile(self.zip) as archive:
            files=archive.infolist()
            self.assertTrue(files[0].filename.endswith('.run'))
            self.assertTrue(files[-1].filename.endswith('.desktop'))
            self.assertEqual((files[-1].external_attr>>16)&0o777,0o755)
            self.assertEqual(archive.testzip(),None)

    @unittest.skipUnless(shutil.which('desktop-file-validate'),'Requires desktop-file-utils and libgio')
    def test_desktop_entry_launches_with_real_freedesktop_parser(self):
        result=subprocess.run(['desktop-file-validate',str(self.desktop)],text=True,capture_output=True)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        result=subprocess.run([sys.executable,str(ROOT/'tests/helpers/linux-desktop-launch.py'),str(self.desktop)],env=self.env,text=True,capture_output=True,timeout=10)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        self.wait_for(self.home/'opened')

if __name__=='__main__': unittest.main(verbosity=2)
