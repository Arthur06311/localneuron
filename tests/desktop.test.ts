import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const {allowsClipboard}=createRequire(import.meta.url)(resolve('desktop/permissions.cjs'));
test('Desktop permite copiar texto somente da origem local e continua negando leitura do clipboard',()=>{
 const origin='http://127.0.0.1:4318';assert.equal(allowsClipboard('clipboard-sanitized-write',origin+'/',origin+'/',origin),true);
 for(const [permission,request,main] of [['clipboard-read',origin,origin],['clipboard-sanitized-write','https://evil.example',origin],['clipboard-sanitized-write',origin,'https://evil.example'],['media',origin,origin],['clipboard-sanitized-write','file:///tmp/index.html',origin]])assert.equal(allowsClipboard(permission,request,main,origin),false);
});
