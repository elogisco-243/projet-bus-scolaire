/**
 * UI-173 isolated reference authentication service for local testing.
 * NOT deployed, NOT production-ready. No real children or credentials.
 * Caller-provided roles are ignored; membership is resolved from server records.
 */
import {createServer} from 'node:http';
import {randomBytes,randomUUID,scryptSync,timingSafeEqual} from 'node:crypto';
import {authorizeOperationalAction} from './operational-policy.mjs';

const hash=(password,salt)=>scryptSync(password,salt,32);
export function createAuthService({accounts=[],allowLocalHttpForTests=false,ttlMs=900000,now=()=>Date.now()}={}){
  if(!allowLocalHttpForTests)throw Error('TLS_GATEWAY_REQUIRED');
  const users=new Map(),sessions=new Map(),audit=[];
  for(const account of accounts){
    if(!account?.id||!account?.password||!account?.organizationId||!account?.role||!account?.login)throw Error('INVALID_ACCOUNT');
    if(users.has(account.login))throw Error('DUPLICATE_LOGIN');
    const salt=randomBytes(16);
    users.set(account.login,{id:account.id,role:account.role,organizationId:account.organizationId,
      assignedTripIds:[...(account.assignedTripIds||[])],authorizedStudentIds:[...(account.authorizedStudentIds||[])],
      salt,passwordHash:hash(account.password,salt),active:account.active!==false});
  }
  const record=(type,subject,outcome)=>{audit.push(Object.freeze({id:randomUUID(),type,subject,outcome,at:now()}));};
  const deny=(res,code,status=403)=>send(res,status,{ok:false,code});
  function send(res,status,obj){res.writeHead(status,{'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'});
    res.end(JSON.stringify(obj));}
  async function json(req){
    if(!String(req.headers['content-type']||'').startsWith('application/json'))throw Error('JSON_REQUIRED');
    let size=0;const parts=[];
    for await(const chunk of req){size+=chunk.length;if(size>8192)throw Error('REQUEST_TOO_LARGE');parts.push(chunk);}
    const parsed=JSON.parse(Buffer.concat(parts).toString('utf8'));
    if(!parsed||Array.isArray(parsed)||typeof parsed!=='object')throw Error('INVALID_JSON');
    return parsed;
  }
  const lookup=req=>{
    const header=String(req.headers.authorization||'');
    if(!header.startsWith('Bearer '))return null;
    const token=header.slice(7);
    const session=sessions.get(token);
    if(!session||session.expiresAt<=now()){sessions.delete(token);return null;}
    return {token,session};
  };
  const handler=async(req,res)=>{
    try{
      const path=new URL(req.url,'http://localhost').pathname;
      if(req.method==='GET'&&path==='/health')return send(res,200,{mode:'AUTH_REFERENCE_ONLY',operationalReady:false});
      if(req.method==='POST'&&path==='/login'){
        const body=await json(req);
        if(typeof body.login!=='string'||typeof body.password!=='string')return deny(res,'INVALID_CREDENTIALS',401);
        const user=users.get(body.login);
        // Work factor for both nonexistent and existing usernames; no username enumeration.
        const salt=user?.salt||Buffer.alloc(16,7);
        const computed=hash(body.password,salt);
        if(!user||!timingSafeEqual(computed,user.passwordHash)||!user.active){
          record('LOGIN',body.login,'DENIED');return deny(res,'INVALID_CREDENTIALS',401);
        }
        const token=randomBytes(32).toString('hex');
        sessions.set(token,{user,expiresAt:now()+ttlMs});
        record('LOGIN',user.id,'SUCCESS');
        return send(res,200,{token,expiresAt:now()+ttlMs,role:user.role});
      }
      if(req.method==='POST'&&path==='/logout'){
        const auth=lookup(req);if(!auth)return deny(res,'AUTHENTICATION_REQUIRED',401);
        sessions.delete(auth.token);record('LOGOUT',auth.session.user.id,'SUCCESS');
        return send(res,200,{ok:true});
      }
      if(req.method==='POST'&&path==='/authorize'){
        const auth=lookup(req);if(!auth)return deny(res,'AUTHENTICATION_REQUIRED',401);
        const body=await json(req);
        const user=auth.session.user;
        const decision=authorizeOperationalAction({principal:{
          id:user.id,source:'trusted_gateway',active:user.active,role:user.role,
          organizationId:user.organizationId,assignedTripIds:user.assignedTripIds,
          authorizedStudentIds:user.authorizedStudentIds
        },action:body.action,resource:body.resource,
        verifiedContext:{serverVerified:true,authenticationStrength:'verified'}});
        record('AUTHORIZE',user.id,decision.code);
        return send(res,decision.ok?200:403,decision);
      }
      return deny(res,'NOT_FOUND',404);
    }catch(error){return deny(res,['JSON_REQUIRED','REQUEST_TOO_LARGE','INVALID_JSON'].includes(error.message)?error.message:'INVALID_REQUEST',400);}
  };
  return {listen:({port=0,host='127.0.0.1'}={})=>{
    if(host!=='127.0.0.1')throw Error('LOCALHOST_ONLY');
    const server=createServer((req,res)=>{void handler(req,res);});
    server.listen(port,host);return server;
  },audit:()=>audit.map(x=>({...x})),revokeAll:()=>sessions.clear()};
}
