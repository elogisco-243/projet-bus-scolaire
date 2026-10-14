'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {loadConfig,validateLocation,authorized,auth}=require('../src/tracker');
const token='a'.repeat(64);
test('le serveur refuse les secrets absents ou faibles',()=>{
  assert.throws(()=>loadConfig({}),/BUS_ACCESS_TOKENS/);
  assert.throws(()=>loadConfig({BUS_ACCESS_TOKENS:JSON.stringify([{token:'demo',role:'driver',busIds:['BUS_1']}])}));
});
test('tokens et roles bus',()=>{
  const accounts=[{token,role:'parent',busIds:['BUS_A']}];
  assert.equal(auth(accounts,token).role,'parent');
  assert.equal(auth(accounts,'invalid'),null);
  assert.equal(authorized(accounts[0],'BUS_A'),true);
  assert.equal(authorized(accounts[0],'BUS_B'),false);
});
test('coordonnees invalides refusees et date serveur utilisee',()=>{
  const now=Date.parse('2026-10-14T08:00:00Z');
  const gps={bus_id:'BUS_A',latitude:-1.6,longitude:29.2};
  assert.equal(validateLocation(gps,now).value.timestamp,'2026-10-14T08:00:00.000Z');
  assert.equal(validateLocation({...gps,latitude:99},now).error,'INVALID_LOCATION');
  assert.equal(validateLocation({...gps,longitude:'29.2'},now).error,'INVALID_LOCATION');
  assert.equal(validateLocation({...gps,timestamp:'2000-01-01'},now).error,'INVALID_TIMESTAMP');
});
