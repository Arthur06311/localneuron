import {existsSync} from 'node:fs';
import {win32} from 'node:path';
export function windowsRuntimeReady(platform:string=process.platform,exists:(path:string)=>boolean=existsSync,windows=process.env.WINDIR||'C:\\Windows'){
 return platform!=='win32'||['msvcp140.dll','vcruntime140.dll','vcruntime140_1.dll'].every(file=>exists(win32.join(windows,'System32',file)));
}
export const windowsRuntimeMessage='Instale ou atualize o Microsoft Visual C++ v14 x64 pelos requisitos do Windows em Modelos. Esse componente é necessário para iniciar os motores locais.';
