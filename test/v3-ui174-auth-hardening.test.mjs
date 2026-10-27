import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthService} from '../mobile-session22/auth-server.mjs';
async function setup(t,options={}){
 let clock=1000;
 const service=createAuthService({allowLocalHttpForTests:true,maxFailures:3,lockoutMs:1000,now:()=>clock,
  accounts:[{id:'DR-1',login:'driver-test',password:'a-long-test-password',role:'driver',
   organizationId:'SCHOOL-A',assignedTripIds:['TRIP-1']}],...options});
 const server=service.listen();
 await new Promise(resolve=>server.once('listening',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base='http://127.0.0.1:'+server.address().port;
 const login=async(password,loginName='driver-test')=>{
  const response=await fetch(base+'/login',{method:'POST',
   headers:{'content-type':'application/json'},
   body:JSON.stringify({login:loginName,password})});
  return {status:response.status,data:await response.json()};
 };
 return {service,login,advance:(ms)=>{clock+=ms;}};
}
test('UI174/01: repeated failed login locks out the test account',async t=>{
 const h=await setup(t);
 assert.equal((await h.login('wrong')).status,401);
 assert.equal((await h.login('wrong')).status,401);
 assert.equal((await h.login('wrong')).status,401);
 const locked=await h.login('a-long-test-password');
 assert.equal(locked.status,429);
 assert.equal(locked.data.code,'LOGIN_RATE_LIMITED');
});
test('UI174/02: lockout expires and correct credentials work again',async t=>{
 const h=await setup(t);
 for(let i=0;i<3;i++)await h.login('wrong');
 h.advance(1001);
 const r=await h.login('a-long-test-password');
 assert.equal(r.status,200);
 assert.equal(r.data.role,'driver');
});
test('UI174/03: successful login resets failed-attempt counter',async t=>{
 const h=await setup(t);
 await h.login('wrong');
 assert.equal((await h.login('a-long-test-password')).status,200);
 await h.login('wrong');
 await h.login('wrong');
 assert.equal((await h.login('a-long-test-password')).status,200);
});
test('UI174/04: audit records rate-limited attempts without recording passwords',async t=>{
 const h=await setup(t);
 for(let i=0;i<3;i++)await h.login('wrong');
 await h.login('a-long-test-password');
 const audit=h.service.audit();
 assert.ok(audit.some(x=>x.outcome==='RATE_LIMITED'));
 assert.equal(JSON.stringify(audit).includes('a-long-test-password'),false);
});
test.todo('UI174/REAL: persistent distributed rate limiting, source-IP/account protections, account recovery');
test.todo('UI174/REAL: persistent tamper-evident audit, TLS and secure credential provisioning');
test.todo('UI174/REAL: session store, revocation across servers, MFA and penetration testing');
