import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('../website/',import.meta.url));
test('A pasta website em main fica vazia de propósito e aponta para gh-pages',async()=>{
 assert.deepEqual((await readdir(root)).sort(),['README.md']);
 const readme=await readFile(resolve(root,'README.md'),'utf8');
 assert.match(readme,/gh-pages/);
 assert.match(readme,/localneuron\.ai/);
 assert.match(readme,/pull request/i);
});
