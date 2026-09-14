import io
import json
from pathlib import Path
import runpy
import sys
from types import SimpleNamespace as NS
import unittest
from unittest.mock import patch


class BridgeTests(unittest.TestCase):
    def test_snapshot_apply_and_stale_project(self):
        original = NS(GetUniqueId=lambda: 'original', GetName=lambda: 'Original')
        created = []
        appended = []
        state = {'timeline': original}
        clip = NS(GetMediaId=lambda: 'clip-1', GetClipProperty=lambda: {'Frames': '120', 'Type': 'Video'}, GetName=lambda: 'Produto')
        folder = NS(GetClipList=lambda: [clip], GetSubFolderList=lambda: [])

        def create(name):
            timeline = NS(GetUniqueId=lambda: 'new', GetName=lambda: name)
            created.append(timeline)
            return timeline

        def current(timeline):
            state['timeline'] = timeline
            return True

        def append(edits):
            appended.extend(edits)
            return [NS() for edit in edits]

        pool = NS(GetRootFolder=lambda: folder, CreateEmptyTimeline=create, AppendToTimeline=append)
        project = NS(GetName=lambda: 'Projeto', GetUniqueId=lambda: 'project-1', GetMediaPool=lambda: pool, GetCurrentTimeline=lambda: state['timeline'], SetCurrentTimeline=current)
        resolve = NS(GetProjectManager=lambda: NS(GetCurrentProject=lambda: project), GetVersionString=lambda: '20.3')
        module = runpy.run_path(str(Path(__file__).parents[1] / 'desktop/resolve-bridge.py'))

        def call(body):
            with patch.dict(sys.modules, {'DaVinciResolveScript': NS(scriptapp=lambda name: resolve)}), patch('os.path.isfile', return_value=True), patch('sys.stdin', io.StringIO(json.dumps(body))):
                return module['main']()

        snapshot = call({'operation': 'status'})
        plan = {'name': 'Nova montagem', 'summary': 'Abertura', 'segments': [{'clip': 'clip-1', 'start': 10, 'end': 40, 'reason': ''}]}
        stale = dict(snapshot, project_id='wrong')
        with self.assertRaisesRegex(RuntimeError, 'projeto mudou'):
            call({'operation': 'apply', 'snapshot': stale, 'plan': plan})
        self.assertEqual(created, [])
        result = call({'operation': 'apply', 'snapshot': snapshot, 'plan': plan})
        self.assertTrue(result['ok'])
        self.assertEqual(result['segments'], 1)
        self.assertEqual(appended[0]['endFrame'], 39)
        self.assertEqual(original.GetName(), 'Original')
        self.assertEqual(state['timeline'].GetUniqueId(), 'new')
        with self.assertRaisesRegex(RuntimeError, 'projeto mudou'):
            call({'operation': 'apply', 'snapshot': snapshot, 'plan': plan})


if __name__ == '__main__':
    unittest.main()
