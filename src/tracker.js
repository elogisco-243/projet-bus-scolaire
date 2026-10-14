'use strict';
const http = require('node:http');
const { timingSafeEqual } = require('node:crypto');
const express = require('express');
const { Server } = require('socket.io');

const validBusId = id => typeof id === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/.test(id);
const validCoordinate = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;

function validateLocation(payload, now=Date.now()) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
      !validBusId(payload.bus_id) || !validCoordinate(payload.latitude,-90,90) ||
      !validCoordinate(payload.longitude,-180,180)) return {error:'INVALID_LOCATION'};
  if (payload.timestamp !== undefined && (typeof payload.timestamp !== 'string' ||
      !Number.isFinite(Date.parse(payload.timestamp)) ||
      Math.abs(Date.parse(payload.timestamp) - now) > 300000)) return {error:'INVALID_TIMESTAMP'};
  return {value:{bus_id:payload.bus_id,latitude:payload.latitude,
    longitude:payload.longitude,timestamp:new Date(now).toISOString()}};
}
function loadConfig(env=process.env) {
  let accounts;
  try { accounts=JSON.parse(env.BUS_ACCESS_TOKENS); } catch {throw Error('BUS_ACCESS_TOKENS: JSON requis');}
  if (!Array.isArray(accounts) || accounts.length===0) throw Error('BUS_ACCESS_TOKENS vide');
  const seen=new Set();
  for (const a of accounts) {
    if (!a || typeof a.token!=='string' || a.token.length<32 || a.token.includes('REPLACE_ME') ||
        seen.has(a.token) || !['driver','parent','admin'].includes(a.role) ||
        !Array.isArray(a.busIds) || !a.busIds.length ||
        !a.busIds.every(id=>validBusId(id) || (id==='*' && a.role==='admin'))) throw Error('Compte invalide');
    seen.add(a.token);
  }
  const port=Number(env.PORT||3000);
  if (!Number.isInteger(port) || port<1 || port>65535) throw Error('PORT invalide');
  return {accounts,port,host:env.HOST||'127.0.0.1'};
}
function auth(accounts,token) {
  if (typeof token!=='string' || token.length>512) return null;
  const input=Buffer.from(token);
  for (const account of accounts) {
    const candidate=Buffer.from(account.token);
    if (candidate.length===input.length && timingSafeEqual(candidate,input))
      return {role:account.role,busIds:account.busIds};
  }
  return null;
}
const authorized=(identity,id)=>validBusId(id) && (identity.busIds.includes(id) ||
  (identity.role==='admin' && identity.busIds.includes('*')));

function createTrackingServer(accounts) {
  const app=express(); app.disable('x-powered-by');
  app.get('/health',(_req,res)=>res.json({status:'ok',version:'2.0.0'}));
  const server=http.createServer(app);
  const io=new Server(server,{serveClient:false,maxHttpBufferSize:4096,cors:{origin:false}});
  const positions=new Map();
  io.use((socket,next)=>{
    const identity=auth(accounts,socket.handshake.auth?.token);
    if (!identity) return next(Error('UNAUTHORIZED'));
    socket.data.identity=identity; next();
  });
  io.on('connection',socket=>{
    const identity=socket.data.identity;
    let lastUpdate=0;
    const fail=code=>socket.emit('server:error',{code});
    socket.on('driver:update_location',payload=>{
      if (identity.role!=='driver') return fail('FORBIDDEN');
      const now=Date.now(), check=validateLocation(payload,now);
      if (check.error) return fail(check.error);
      if (!authorized(identity,check.value.bus_id)) return fail('FORBIDDEN_BUS');
      if (now-lastUpdate<500) return fail('RATE_LIMITED');
      lastUpdate=now;
      positions.set(check.value.bus_id,{data:check.value,time:now});
      io.to('bus:'+check.value.bus_id).emit('parent:bus_location_update',check.value);
      socket.emit('driver:location_accepted',{bus_id:check.value.bus_id,timestamp:check.value.timestamp});
    });
    socket.on('parent:join_bus_room',payload=>{
      if (!['parent','admin'].includes(identity.role)) return fail('FORBIDDEN');
      const id=payload?.busId;
      if (!authorized(identity,id)) return fail('FORBIDDEN_BUS');
      socket.join('bus:'+id);
      socket.emit('parent:subscribed',{busId:id});
      const last=positions.get(id);
      if (last && Date.now()-last.time<=300000) socket.emit('parent:bus_location_update',last.data);
    });
    socket.on('parent:leave_bus_room',payload=>{
      if (!['parent','admin'].includes(identity.role)) return fail('FORBIDDEN');
      const id=payload?.busId;
      if (!authorized(identity,id)) return fail('FORBIDDEN_BUS');
      socket.leave('bus:'+id);
      socket.emit('parent:unsubscribed',{busId:id});
    });
  });
  return {app,server,io};
}
module.exports={loadConfig,auth,validateLocation,authorized,createTrackingServer};
