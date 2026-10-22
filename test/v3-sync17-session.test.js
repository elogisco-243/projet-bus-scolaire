const test=require('node:test');
const assert=require('node:assert/strict');
const load=()=>import('../mobile-session17/session-router.mjs');
const demo=(id,password)=>id==='demo-driver'&&password==='fictif'?{ok:true,role:'driver'}:{ok:false};
test('SYNC17: account-based demo driver session',async()=>{
 const {authenticateScola,mayLoadDemoUI,mayLoadOperationalUI}=await load();
 const s=await authenticateScola('demo-driver','fictif',{openDemoSession:demo});
 assert.deepEqual(s,{ok:true,mode:'demo',role:'driver'});
 assert.equal(mayLoadDemoUI(s),true);assert.equal(mayLoadOperationalUI(s),false);
});
test('SYNC17: no production server means refusal, never demo fallback',async()=>{
 const {authenticateScola}=await load();
 const s=await authenticateScola('operator@example.invalid','secret',{openDemoSession:demo});
 assert.equal(s.ok,false);assert.equal(s.code,'OPERATIONAL_DISABLED');
});
test('SYNC17: wrong password is refused',async()=>{
 const {authenticateScola}=await load();
 assert.equal((await authenticateScola('demo-driver','bad',{openDemoSession:demo})).ok,false);
});
test('SYNC17: invalid role is refused',async()=>{
 const {authenticateScola}=await load();
 assert.equal((await authenticateScola('x','y',{openDemoSession:()=>({ok:true,role:'super-admin'})})).code,'INVALID_DEMO_ROLE');
});
test('SYNC17: admin-web demo cannot accidentally render parent',async()=>{
 const {authenticateScola}=await load();
 assert.equal((await authenticateScola('x','y',{openDemoSession:()=>({ok:true,role:'admin-web'})})).code,'INVALID_DEMO_ROLE');
});
test('SYNC17: operational provider must present verified subject and organisation',async()=>{
 const {authenticateScola}=await load();
 const s=await authenticateScola('x','y',{openDemoSession:demo,operationalAdapter:{authenticate:async()=>({ok:true,mode:'operational',serverVerified:true,role:'driver'})}});
 assert.equal(s.ok,false);assert.equal(s.code,'OPERATIONAL_AUTH_FAILED');
});
test('SYNC17: operational and demo UI are mutually exclusive',async()=>{
 const {authenticateScola,mayLoadOperationalUI,mayLoadDemoUI}=await load();
 const s=await authenticateScola('x','y',{openDemoSession:demo,operationalAdapter:{authenticate:async()=>({ok:true,mode:'operational',serverVerified:true,role:'driver',subject:'synthetic-sub',organizationId:'synthetic-org'})}});
 assert.equal(s.mode,'operational');assert.equal(mayLoadOperationalUI(s),true);assert.equal(mayLoadDemoUI(s),false);
});
test('SYNC17: forged operational session missing server flag cannot render',async()=>{
 const {mayLoadOperationalUI}=await load();
 assert.equal(mayLoadOperationalUI({ok:true,mode:'operational',role:'driver',subject:'fake',organizationId:'fake'}),false);
});
test('SYNC17: demo authentication failure fails closed',async()=>{
 const {authenticateScola}=await load();
 const s=await authenticateScola('x','y',{openDemoSession:()=>{throw Error('bad')}});
 assert.equal(s.code,'DEMO_AUTH_ERROR');
});
