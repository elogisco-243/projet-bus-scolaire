/** UI-189: Non-invasive adapter for established four-role demo workflows.
 * No imports or edits to original Chauffeur / Accompagnateur UI resources.
 * No operational commands, identity claims, or multi-device synchronization.
 */
import {executeFourRoleDemo,fourRoleDemoView,createFourRoleDemo} from './four-role-demo-workflow.mjs';
const fail=code=>Object.freeze({ok:false,code});
const ROUTES=Object.freeze({
 driver:Object.freeze({
  secure_vehicle:'secure_vehicle',begin:'start_trip',arrive:'arrive_stop',
  resume:'resume_trip','close-trip':'finish_trip',incident:'report_incident'
 }),
 attendant:Object.freeze({
  check_in:'check_in',ready:'ready_departure',board:'board',
  alight:'alight',mark_absent:'mark_absent',confirm_empty:'confirm_empty',
  incident:'report_incident'
 }),
 parent:Object.freeze({acknowledge:'acknowledge_notification'}),
 supervisor:Object.freeze({resolve_incident:'resolve_incident',review_trip:'review_trip'})
});
export function classifyLegacyGesture({profile,gesture,mode='demo',payload={}}={}){
 if(mode!=='demo')return fail('OPERATIONAL_DISPATCH_DISABLED');
 const mapping=ROUTES[profile];
 if(!mapping)return fail('ROLE_UNKNOWN');
 const action=mapping[gesture];
 if(!action)return fail('LEGACY_ACTION_UNMAPPED');
 if(!payload||typeof payload!=='object'||Array.isArray(payload))return fail('INVALID_ACTION_PAYLOAD');
 return Object.freeze({ok:true,role:profile,action,args:{
  role:profile,action,
  studentId:typeof payload.studentId==='string'?payload.studentId:null,
  incidentId:typeof payload.incidentId==='string'?payload.incidentId:null,
  kind:typeof payload.kind==='string'?payload.kind:null,
  reason:typeof payload.reason==='string'?payload.reason:null
 }});
}
/** Runs against an explicit, detached snapshot. Does not hook DOM/UI gestures. */
export function simulateLegacyGesture(snapshot,request){
 const mapped=classifyLegacyGesture(request);
 if(!mapped.ok)return mapped;
 return executeFourRoleDemo(snapshot,mapped.args);
}
export function initialUnifiedDemo(){return createFourRoleDemo();}
export function readUnifiedRole(snapshot,{profile,parentStudentIds=[]}={}){
 return fourRoleDemoView(snapshot,profile,{parentStudentIds});
}
export const integrationStatus=Object.freeze({
 androidWired:false,uiResourcesAltered:false,operationalEnabled:false,
 remoteSyncEnabled:false,credentialsVerified:false
});
