import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from 'yaml';

const root=fileURLToPath(new URL('..',import.meta.url));
const dir=resolve(root,'.github/ISSUE_TEMPLATE');
const requiredIds=['versao','sistema','sistema-versao','motor','passos','esperado','atual','confirmacoes'];
const engines=['GGUF / llama.cpp (embutido)','MLX / Metal (embutido, Mac)','LM Studio','EXO (cluster)','Minha API (outro computador)','Whisper (voz para texto)','Voz / TTS','stable-diffusion.cpp / estúdio criativo','MCP / ferramentas do agente'];
const inputAttributes={
  markdown:['value'],
  input:['label','description','placeholder','value'],
  textarea:['label','description','placeholder','value','render'],
  dropdown:['label','description','options','multiple','default'],
  checkboxes:['label','description','options'],
};

test('bug report form parses and requires the triage fields',async()=>{
  const form=parse(await readFile(resolve(dir,'bug_report.yml'),'utf8'));
  assert.equal(form.name,'🐞 Relatar um bug');
  assert.equal(typeof form.description,'string');
  assert.ok(form.description.trim());
  assert.deepEqual(form.labels,['bug']);
  assert.deepEqual(Object.keys(form).sort(),['body','description','labels','name','title']);
  const fields=form.body.filter(item=>item.type!=='markdown');
  assert.ok(fields.length>0);
  const ids=fields.map(item=>item.id);
  assert.deepEqual(new Set(ids).size,ids.length);
  for(const id of requiredIds)assert.ok(ids.includes(id),id);
  const byId=new Map(fields.map(item=>[item.id,item]));
  for(const id of ['versao','sistema','sistema-versao','motor','passos','esperado','atual']){
    assert.equal(byId.get(id).validations?.required,true,id);
  }
  assert.equal(byId.get('logs').attributes.render,'shell');
  assert.deepEqual(byId.get('motor').attributes.options.filter(option=>option!=='Não se aplica / não sei'),engines);
  const checks=byId.get('confirmacoes').attributes.options;
  assert.equal(checks[0].required,true);
  assert.match(checks[0].label,/colei tokens, chaves de API, senhas/);
  const labels=fields.map(item=>item.attributes.label);
  assert.deepEqual(new Set(labels).size,labels.length);
  for(const item of form.body){
    assert.ok(inputAttributes[item.type],item.type);
    assert.deepEqual(Object.keys(item).filter(key=>key!=='type'&&key!=='id'&&key!=='attributes'&&key!=='validations'),[]);
    for(const key of Object.keys(item.attributes))assert.ok(inputAttributes[item.type].includes(key),`${item.type}.${key}`);
    if(item.type!=='markdown')assert.match(item.id,/^[A-Za-z0-9_-]+$/);
    if(item.type==='dropdown'||item.type==='checkboxes'){
      const options=item.type==='dropdown'?item.attributes.options:item.attributes.options.map(option=>option.label);
      assert.deepEqual(new Set(options).size,options.length);
      for(const option of options)assert.equal(typeof option,'string');
    }
  }
});

test('issue template config disables blank issues and points at real destinations',async()=>{
  const config=parse(await readFile(resolve(dir,'config.yml'),'utf8'));
  assert.equal(config.blank_issues_enabled,false);
  assert.deepEqual(Object.keys(config).sort(),['blank_issues_enabled','contact_links']);
  assert.deepEqual(config.contact_links.map(link=>link.url),[
    'https://github.com/Arthur06311/localneuron/security/advisories/new',
    'https://Arthur06311.github.io/localneuron/',
    'https://github.com/Arthur06311/localneuron/blob/main/docs/linux-installer.md',
  ]);
  for(const link of config.contact_links){
    assert.equal(typeof link.name,'string');
    assert.ok(link.name.trim());
    assert.equal(typeof link.about,'string');
    assert.ok(link.about.trim());
    assert.match(link.url,/^https:\/\//);
  }
  assert.equal(existsSync(resolve(root,'docs/linux-installer.md')),true);
});
