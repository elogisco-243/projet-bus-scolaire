/**
 * UI-168 TEST BENCH: real HTTP exchange across 4 browser tabs, one IN-MEMORY
 * fake trip. Localhost-only by launcher. Sessions are freely minted demo roles,
 * NOT a credential check. NEVER expose on LAN or route to operational API.
 */
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {newCoordinationDemo,applyCoordinationDemo,viewCoordinationDemo} from './coordination-demo.mjs';

const base=dirname(fileURLToPath(import.meta.url));
const PROFILES=Object.freeze({
 chauffeur:{role:'driver',actorId:'DR-DEMO'},
 accompagnateur:{role:'attendant',actorId:'AT-DEMO'},
 parent:{role:'parent',actorId:'PA-DEMO'},
 parent2:{role:'parent',actorId:'PB-DEMO'},
 superviseur:{role:'supervisor',actorId:'SU-DEMO'}
});
const headers={
 'cache-control':'no-store','x-content-type-options':'nosniff',
 'referrer-policy':'no-referrer','x-frame-options':'DENY',
 'content-security-policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"
};
function answer(res,status,object){
 res.writeHead(status,{...headers,'content-type':'application/json; charset=utf-8'});
 res.end(JSON.stringify(object));
}
const mime={'/':'text/html; charset=utf-8','/app.mjs':'text/javascript; charset=utf-8','/style.css':'text/css; charset=utf-8'};
const staticFiles={'/':'demo-ui.html','/app.mjs':'demo-ui.mjs','/style.css':'demo-ui.css'};
const errStatus=code=>code==='STALE_REVISION'?409:
 ['DEMO_ROLE_DENIED','OPERATIONAL_SERVER_REQUIRED','SCOPE_MISMATCH','PARENT_NOT_AUTHORIZED'].includes(code)?403:422;
async function body(req){
 const chunks=[];let len=0;
 for await(const chunk of req){
  len+=chunk.length;if(len>16384)throw Error('REQUEST_TOO_LARGE');
  chunks.push(chunk);
 }
 try{
  const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(!data||typeof data!=='object'||Array.isArray(data))throw Error();
  return data;
 }catch{throw Error('INVALID_JSON');}
}
export function createDemoHub(){
 let current=newCoordinationDemo();
 const sessions=new Map();
 let listeners=new Set();
 const notify=()=>{for(const fn of [...listeners])fn();};
 const hub=async(req,res)=>{
  try{
   const url=new URL(req.url,'http://localhost');
   const path=url.pathname;
   if(req.headers.origin){
    const origin=new URL(req.headers.origin);
    if(origin.host!==req.headers.host||origin.protocol!=='http:'){answer(res,403,{error:'CROSS_ORIGIN_DENIED'});return;}
   }
   if(req.method==='GET'&&Object.hasOwn(staticFiles,path)){
    const file=await readFile(join(base,staticFiles[path]));
    res.writeHead(200,{...headers,'content-type':mime[path]});res.end(file);return;
   }
   if(req.method==='GET'&&path==='/api/health'){
    answer(res,200,{mode:'DEMO_ONLY',realAuthentication:false,connectedDevices:false,revision:current.revision});
    return;
   }
   if(req.method==='POST'&&path==='/api/join'){
    if(!String(req.headers['content-type']||'').startsWith('application/json')){answer(res,415,{error:'JSON_REQUIRED'});return;}
    const data=await body(req);
    if(!Object.hasOwn(PROFILES,data.profile)){answer(res,400,{error:'INVALID_DEMO_PROFILE'});return;}
    const token=randomBytes(24).toString('hex');
    sessions.set(token,PROFILES[data.profile]);
    answer(res,200,{token,profile:data.profile,role:PROFILES[data.profile].role,
      demo:true,warning:'Role chosen without real identity check. Local test only.'});
    return;
   }
   if((path==='/api/state'&&req.method==='GET')||
      (path==='/api/action'&&req.method==='POST')||
      (path==='/api/reset'&&req.method==='POST')){
    const auth=String(req.headers.authorization||'');
    const session=auth.startsWith('Bearer ')?sessions.get(auth.slice(7)):null;
    if(!session){answer(res,401,{error:'TEST_SESSION_REQUIRED'});return;}
    if(req.method==='GET'){
      answer(res,200,{snapshot:viewCoordinationDemo(current,session.actorId)});
      return;
    }
    if(!String(req.headers['content-type']||'').startsWith('application/json')){answer(res,415,{error:'JSON_REQUIRED'});return;}
    const data=await body(req);
    if(path==='/api/reset'){
      if(session.role!=='supervisor'){answer(res,403,{error:'SUPERVISOR_DEMO_ONLY'});return;}
      if(data.confirm!=='RESET_DEMO_ONLY'){answer(res,422,{error:'RESET_CONFIRMATION_REQUIRED'});return;}
      current=newCoordinationDemo();notify();
      answer(res,200,{snapshot:viewCoordinationDemo(current,session.actorId)});return;
    }
    if(typeof data.type!=='string'||typeof data.commandId!=='string'||!Number.isSafeInteger(data.expectedRevision)){
      answer(res,400,{error:'COMMAND_MALFORMED'});return;
    }
    const response=applyCoordinationDemo(current,{
      mode:'demo',organizationId:current.organizationId,tripId:current.tripId,
      role:session.role,actorId:session.actorId,type:data.type,commandId:data.commandId,
      expectedRevision:data.expectedRevision,payload:data.payload??{}
    });
    current=response.state;
    if(response.accepted)notify();
    answer(res,200,{accepted:response.accepted,alreadyApplied:response.alreadyApplied,
      snapshot:viewCoordinationDemo(current,session.actorId)});
    return;
   }
   answer(res,404,{error:'NOT_FOUND'});
  }catch(error){
   const code=typeof error.message==='string'?error.message:'INTERNAL_ERROR';
   answer(res,errStatus(code),{error:code});
  }
 };
 return {handler:hub,listen:({port=4177,host='127.0.0.1'}={})=>{
   if(host!=='127.0.0.1')throw Error('LOCALHOST_ONLY');
   const server=createServer((req,res)=>{void hub(req,res);});
   server.listen(port,host);return server;
 },getState:()=>structuredClone(current)};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 const port=Number(process.env.A2S_DEMO_SYNC_PORT||4177);
 if(!Number.isInteger(port)||port<1024||port>65535)throw Error('INVALID_DEMO_PORT');
 createDemoHub().listen({port});
 console.log('A2S Scola - UI168 DEMO synchrone LOCAL UNIQUEMENT : http://127.0.0.1:'+port);
 console.log('Identites fictives. Aucune API de production. Aucune authentification reelle.');
}
