"""Fixed Resolve SDK operations. Never executes model-generated Python."""
import json
import os
import sys


def main():
    request = json.load(sys.stdin)
    locations = {
        'darwin': '/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting',
        'win32': os.path.join(os.environ.get('PROGRAMDATA', 'C:\\ProgramData'), 'Blackmagic Design/DaVinci Resolve/Support/Developer/Scripting'),
        'linux': '/opt/resolve/Developer/Scripting',
    }
    api = locations.get(sys.platform, locations['linux'])
    libraries = {
        'darwin': '/Applications/DaVinci Resolve/DaVinci Resolve.app/Contents/Libraries/Fusion/fusionscript.so',
        'win32': os.path.join(os.environ.get('PROGRAMFILES', 'C:\\Program Files'), 'Blackmagic Design/DaVinci Resolve/fusionscript.dll'),
        'linux': '/opt/resolve/libs/Fusion/fusionscript.so',
    }
    if not os.path.isfile(os.path.join(api, 'Modules', 'DaVinciResolveScript.py')):
        raise RuntimeError('SDK do DaVinci não encontrado. Instale o DaVinci Resolve Studio neste computador.')
    os.environ['RESOLVE_SCRIPT_API'] = api
    os.environ['RESOLVE_SCRIPT_LIB'] = libraries.get(sys.platform, libraries['linux'])
    sys.path.insert(0, os.path.join(api, 'Modules'))
    import DaVinciResolveScript
    resolve = DaVinciResolveScript.scriptapp('Resolve')
    if not resolve:
        raise RuntimeError('Abra o DaVinci Resolve Studio e habilite External scripting using: Local nas preferências de sistema.')
    project = resolve.GetProjectManager().GetCurrentProject()
    if not project:
        raise RuntimeError('Abra um projeto no DaVinci antes de conectar.')
    pool = project.GetMediaPool()
    items = {}

    def scan(folder):
        for clip in folder.GetClipList() or []:
            if len(items) >= 500:
                return
            items[clip.GetMediaId()] = clip
        for child in folder.GetSubFolderList() or []:
            if len(items) < 500:
                scan(child)

    scan(pool.GetRootFolder())
    clips = []
    for key, clip in items.items():
        props = clip.GetClipProperty() or {}
        try:
            frames = int(float(str(props.get('Frames', '0')).replace(',', '')))
        except ValueError:
            frames = 0
        if frames > 0:
            clips.append({'id': key, 'name': str(clip.GetName())[:200], 'frames': frames, 'type': str(props.get('Type', ''))[:60]})
    timeline = project.GetCurrentTimeline()
    snapshot = {'project': project.GetName(), 'project_id': project.GetUniqueId(), 'timeline_id': timeline.GetUniqueId() if timeline else '', 'clips': clips, 'version': resolve.GetVersionString()}
    if request['operation'] == 'status':
        return snapshot
    if request['operation'] != 'apply':
        raise RuntimeError('Operação desconhecida.')
    if snapshot != request['snapshot']:
        raise RuntimeError('O projeto mudou. Conecte novamente e gere um novo plano antes de aplicar.')
    plan = request['plan']
    lookup = {clip['id']: clip for clip in clips}
    edits = []
    for segment in plan['segments']:
        source = lookup.get(segment['clip'])
        start, end = segment['start'], segment['end']
        if not source or not isinstance(start, int) or not isinstance(end, int) or not 0 <= start < end <= source['frames']:
            raise RuntimeError('Trecho inválido no plano.')
        edits.append({'mediaPoolItem': items[segment['clip']], 'startFrame': start, 'endFrame': end - 1})
    if not 1 <= len(edits) <= 80:
        raise RuntimeError('Escolha de 1 a 80 trechos.')
    created = pool.CreateEmptyTimeline(plan['name'])
    if not created:
        raise RuntimeError('O DaVinci não criou a timeline. Use outro nome.')
    try:
        if not project.SetCurrentTimeline(created):
            raise RuntimeError('Não foi possível selecionar a nova timeline.')
        results = pool.AppendToTimeline(edits)
        if not results or len(results) != len(edits):
            raise RuntimeError('Alguns trechos não foram inseridos. Revise a nova timeline; a original foi preservada.')
        return {'ok': True, 'timeline': created.GetName(), 'timeline_id': created.GetUniqueId(), 'segments': len(results)}
    except Exception as error:
        raise RuntimeError('Timeline criada: ' + plan['name'] + '. ' + str(error))


if __name__ == '__main__':
    try:
        value = {'ok': True, 'data': main()}
    except Exception as error:
        value = {'ok': False, 'error': str(error)}
    print('LOCALNEURON_RESULT:' + json.dumps(value, ensure_ascii=False))
