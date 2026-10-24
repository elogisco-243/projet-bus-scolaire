'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync, sign } = require('node:crypto');
const { createJwtVerifier } = require('../src/v3/jwt');

const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const {privateKey:otherPrivateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const pem=publicKey.export({type:'spki',format:'pem'});
const FIXED=2000000000;
const issuer='https://identity.example.org/';
const audience='bus-scolaire-v3';
const verifier=createJwtVerifier({issuer,audience,publicKeyPem:pem,keyId:'school-key',now:()=>FIXED*1000});
function token(payload={}, header={}, signingKey=privateKey){
  const h=Buffer.from(JSON.stringify({alg:'RS256',typ:'at+jwt',kid:'school-key',...header})).toString('base64url');
  const p=Buffer.from(JSON.stringify({iss:issuer,aud:audience,sub:'user-1',iat:FIXED-3,exp:FIXED+120,...payload})).toString('base64url');
  const sig=sign('RSA-SHA256',Buffer.from(`${h}.${p}`),signingKey).toString('base64url');
  return `${h}.${p}.${sig}`;
}
test('accepte uniquement un jeton RS256 signe par la cle epinglee',()=>{
  assert.deepEqual(verifier(token()),{subject:'user-1'});
  assert.throws(()=>verifier(token({}, {},otherPrivateKey)),/INVALID_TOKEN/);
});
test('refuse les fausses identites, autres audiences et emetteurs',()=>{
  for(const changes of [{iss:'https://wrong.example/'},{aud:'another'},{sub:''},{aud:['wrong']}])
    assert.throws(()=>verifier(token(changes)),/INVALID_TOKEN/);
});
test('refuse expiration, dates futures et jetons trop longs',()=>{
  for(const changes of [{exp:FIXED-1},{iat:FIXED+300},{nbf:FIXED+300},
    {iat:FIXED-4000,exp:FIXED+120}]) assert.throws(()=>verifier(token(changes)),/INVALID_TOKEN/);
  assert.throws(()=>verifier('x'.repeat(8193)),/INVALID_TOKEN/);
});
test('refuse algorithme inconnu, kid modifie et references distantes',()=>{
  for(const changes of [{alg:'none'},{alg:'HS256'},{typ:'JWT'},{kid:'other'},{jku:'https://attacker.example/jwks'},
    {jwk:{kty:'RSA'}},{crit:['exp']}]) assert.throws(()=>verifier(token({},changes)),/INVALID_TOKEN/);
});
test('refuse tokens malformes et absence de configuration',()=>{
  for(const bad of ['', 'abcd','x.y.z']) assert.throws(()=>verifier(bad),/INVALID_TOKEN/);
  assert.throws(()=>createJwtVerifier({issuer,audience,publicKeyPem:''}));
});
