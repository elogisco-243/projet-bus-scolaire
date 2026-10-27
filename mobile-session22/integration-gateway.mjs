/**
 * UI-176 local reference integration of UI-173 authentication and UI-175 audit.
 * No operational mutations, no production identity, no durable user sessions.
 * Security decision is never returned as allowed unless audit append succeeds.
 */
export function createReferenceGateway({authBaseUrl,journal,testOnly=false}={}){
 if(testOnly!==true)throw Error('OPERATIONAL_INTEGRATION_DISABLED');
 if(typeof authBaseUrl!=='string'||!/^http:\/\/127\.0\.0\.1:\d+$/.test(authBaseUrl))
   throw Error('LOCAL_AUTH_ONLY');
 if(!journal||typeof journal.append!=='function')throw Error('AUDIT_REQUIRED');
 return Object.freeze({
  async authorize({token,action,resource}={}){
   if(typeof token!=='string'||!token||typeof action!=='string'||!action||
      !resource||typeof resource!=='object')
     return Object.freeze({ok:false,code:'INVALID_REQUEST'});
   let response,decision;
   try{
    response=await fetch(authBaseUrl+'/authorize',{
     method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},
     body:JSON.stringify({action,resource}),signal:AbortSignal.timeout(3000)});
    decision=await response.json();
   }catch{return Object.freeze({ok:false,code:'AUTH_SERVICE_UNAVAILABLE'});}
   if(typeof decision?.ok!=='boolean'||typeof decision?.code!=='string')
     return Object.freeze({ok:false,code:'INVALID_AUTH_RESPONSE'});
   // Only allow on explicit HTTP 200 + affirmative decision.
   const permitted=response.status===200&&decision.ok===true;
   try{
    await journal.append({type:'AUTHORIZATION_DECISION',
      action,decision:permitted?'ALLOWED':'DENIED',
      code:permitted?'AUTHORIZED':decision.code});
   }catch{return Object.freeze({ok:false,code:'AUDIT_UNAVAILABLE'});}
   return Object.freeze({ok:permitted,code:permitted?'AUTHORIZED':decision.code});
  }
 });
}
