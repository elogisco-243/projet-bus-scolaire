'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createConfiguredV3Api}=require('../src/v3/bootstrap');

test('configuration V3 incomplete refusee sans affecter V2',()=>{
  assert.throws(()=>createConfiguredV3Api({env:{},db:{query:async()=>({rows:[]})}}),
    /V3_JWT_ISSUER/);
});
