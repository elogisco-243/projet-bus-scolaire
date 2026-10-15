'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { generateKeyPairSync, sign } = require('node:crypto');
const { createJwtVerifier } = require('../src/v3/jwt');
const { createV3Api } = require('../src/v3/api');

test('parcours HTTP complet avec un JWT reel signe, sans confiance dans les en-tetes clients',async()=>{
  const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
  const issuer='https://id.example.org/';
  const audience='bus-v3-staging';
  const now=Math.floor(Date.now()/1000);
  const createToken=(sub,exp=now+90)=>{
    const head=Buffer.from(JSON.stringify({alg:'RS256',typ:'at+jwt'})).toString('base64url');
    const body=Buffer.from(JSON.stringify({iss:issuer,aud:audience,sub,iat:now-10,exp})).toString('base64url');
    return `${head}.${body}.${sign('RSA-SHA256',Buffer.from(`${head}.${body}`),privateKey).toString('base64url')}`;
  };
  const verifier=createJwtVerifier({issuer,audience,publicKeyPem:publicKey.export({type:'spki',format:'pem'})});
  const repository={
    loadActor:async sub=>sub==='verified-parent'?{
      userId:'verified-parent',memberships:[{organizationId:'school-A',role:'parent',active:true}],
      verifiedStudentIds:['child-A']
    }:null,
    listTripContexts:async()=>[],
    listVehicles:async()=>[],
    getTripContext:async()=>null
  };
  const server=http.createServer(createV3Api({verifyToken:verifier,repository}));
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const url=`http://127.0.0.1:${server.address().port}/api/v3/me`;
  try {
    const withAuth=async bearer=>fetch(url,{headers:{authorization:`Bearer ${bearer}`,
      'x-user-id':'admin','x-role':'school_admin'}});
    const good=await withAuth(createToken('verified-parent'));
    assert.equal(good.status,200);
    assert.deepEqual((await good.json()).memberships,[{role:'parent',organizationId:'school-A'}]);
    assert.equal((await withAuth(createToken('unknown-person'))).status,401);
    assert.equal((await withAuth(createToken('verified-parent',now-1))).status,401);
  } finally {
    await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  }
});
