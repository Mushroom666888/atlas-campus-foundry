import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRuntime } from '../server/runtime-server.js';
import { catalog, resolveModules } from '../packages/modules/src/catalog.js';
import { moduleManifestSchema } from '../packages/contracts/src/index.js';

test('manifest contracts and dependency resolution reject cycles, conflicts and missing modules',()=>{
  for(const m of catalog)moduleManifestSchema.parse(m);
  assert.ok(resolveModules(['events']).some(m=>m.moduleId==='identity'));
  assert.throws(()=>resolveModules(['unknown']));
  const changed=catalog.map(m=>m.moduleId==='identity'?{...m,dependencies:{events:'^1.0.0'}}:m);
  assert.throws(()=>resolveModules(['events'],changed),/Cycle/);
  assert.throws(()=>resolveModules(['events'],catalog,{identity:'2.0.0'}));
});
test('real runtime: identity, events, FIFO waitlist, notifications, search, chat, authorization and persistence',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'foundry-runtime-'));
  const config={appId:'test-app',dataDir:root,spec:{name:'Runtime acceptance',description:'Real database acceptance',kind:'study' as const,modules:catalog.map(m=>m.moduleId),features:[],primaryColor:'green' as const},modules:catalog.map(m=>m.moduleId),recipes:[{type:'capacity-waitlist' as const,version:1 as const,entity:'group' as const,capacityField:'capacity' as const,promotion:'fifo' as const,notify:true}]};
  let runtime=await createRuntime(config);
  try {
    const request=(method:'GET'|'POST'|'PATCH',url:string,body?:unknown,cookie?:string)=>runtime.app.inject({method,url,payload:body as object,headers:cookie?{cookie}:{}});
    async function register(email:string){const r=await request('POST','/api/auth/register',{email,password:'Password12345',name:email.split('@')[0]});assert.equal(r.statusCode,201,r.body);return {cookie:r.headers['set-cookie']!.toString().split(';')[0],user:r.json().user};}
    const a=await register('alice@campus.test'),b=await register('bob@campus.test'),c=await register('charlie@campus.test');
    assert.equal((await request('GET','/api/entities')).statusCode,401);
    const group=await request('POST','/api/entities',{kind:'group',title:'Calculus group',body:'Weekly study',data:{capacity:1}},a.cookie);assert.equal(group.statusCode,201,group.body);const id=group.json().id;
    assert.equal((await request('PATCH',`/api/entities/${id}`,{status:'closed'},b.cookie)).statusCode,403);
    const joins=await Promise.all([request('POST',`/api/entities/${id}/join`,{},b.cookie),request('POST',`/api/entities/${id}/join`,{},c.cookie)]);
    assert.deepEqual(joins.map(r=>r.json().status),['joined','waiting']);
    await request('POST',`/api/entities/${id}/leave`,{},b.cookie);
    assert.equal((await request('GET',`/api/entities/${id}/members`,undefined,c.cookie)).json().mine.status,'joined');
    assert.ok((await request('GET','/api/notifications',undefined,c.cookie)).json().items.some((n:{body:string})=>n.body.includes('递补')));
    assert.equal((await request('GET','/api/entities?q=Calculus',undefined,a.cookie)).json().items.length,1);
    assert.equal((await request('GET',"/api/entities?q=%27%20OR%201%3D1--",undefined,a.cookie)).json().items.length,0);
    const conversation=await request('POST','/api/conversations',{title:'Private',members:[b.user.id]},a.cookie);assert.equal(conversation.statusCode,201,conversation.body);
    const cid=conversation.json().id;assert.equal((await request('POST',`/api/conversations/${cid}/messages`,{body:'Meet in the library'},a.cookie)).statusCode,201);
    assert.equal((await request('GET',`/api/conversations/${cid}/messages`,undefined,b.cookie)).json().items.length,1);
    assert.equal((await request('GET',`/api/conversations/${cid}/messages`,undefined,c.cookie)).statusCode,404);
    const csrf=await runtime.app.inject({method:'POST',url:'/api/entities',headers:{cookie:a.cookie,origin:'https://evil.example'},payload:{kind:'post',title:'No'}});assert.equal(csrf.statusCode,403);
    await runtime.app.close();runtime=await createRuntime(config);
    assert.equal((await request('GET',`/api/entities/${id}`,undefined,a.cookie)).json().title,'Calculus group');
    assert.equal((await request('GET',`/api/conversations/${cid}/messages`,undefined,b.cookie)).json().items[0].body,'Meet in the library');
  } finally {await runtime.app.close();await rm(root,{recursive:true,force:true});}
});
