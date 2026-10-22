/** A2S Scola — SYNC-17 session boundary. No production client is enabled. */
export const VALID_ROLES = Object.freeze(['driver','attendant','parent','admin-mobile','admin-web']);
const DEMO_ROLES = Object.freeze(['driver','attendant','parent','admin-mobile']);
const fail=(code,message)=>({ok:false,code,message});
const valid=x=>typeof x==='string'&&x.length>0&&x.length<=512;
export async function authenticateScola(identifier,password,{openDemoSession,operationalAdapter=null}={}){
 if(!valid(identifier)||!valid(password))return fail('INVALID_INPUT','Renseignez vos identifiants.');
 if(typeof openDemoSession!=='function')return fail('CONFIG_ERROR','Connexion non disponible sur cet appareil.');
 let demo;
 try{demo=openDemoSession(identifier,password);}catch{return fail('DEMO_AUTH_ERROR','Identification temporairement indisponible.');}
 if(demo?.ok===true){
   if(!DEMO_ROLES.includes(demo.role))return fail('INVALID_DEMO_ROLE','Profil de démonstration non autorisé.');
   return Object.freeze({ok:true,mode:'demo',role:demo.role});
 }
 if(!operationalAdapter)return fail('OPERATIONAL_DISABLED','Compte de démonstration non reconnu. Le service opérationnel n’est pas encore activé.');
 if(typeof operationalAdapter.authenticate!=='function')return fail('CONFIG_ERROR','Passerelle opérationnelle invalide.');
 try{
  const result=await operationalAdapter.authenticate(identifier,password);
  if(result?.ok!==true||result?.mode!=='operational'||result?.serverVerified!==true||
     !VALID_ROLES.includes(result?.role)||typeof result?.subject!=='string'||!result.subject||
     typeof result?.organizationId!=='string'||!result.organizationId){
     return fail('OPERATIONAL_AUTH_FAILED','Authentification opérationnelle refusée.');
  }
  return Object.freeze({ok:true,mode:'operational',serverVerified:true,role:result.role,
    subject:result.subject,organizationId:result.organizationId});
 }catch{return fail('OPERATIONAL_AUTH_FAILED','Authentification opérationnelle indisponible.');}
}
export function mayLoadDemoUI(session){return session?.ok===true&&session?.mode==='demo'&&DEMO_ROLES.includes(session.role);}
export function mayLoadOperationalUI(session){return session?.ok===true&&session?.mode==='operational'&&session?.serverVerified===true&&VALID_ROLES.includes(session.role)&&!!session.subject&&!!session.organizationId;}
