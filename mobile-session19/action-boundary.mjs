/**
 * UI-178: safety boundary hooked into the COMPLETE Attendant UI.
 * Only observes/classifies an existing local demo gesture.
 * Never authenticates a real actor, submits network commands or changes trip state.
 */
const DEMO_ACTIONS=new Set([
 'demo_prepare_departure','start_demo_trip','simulate_arrival',
 'board','mark_absent','alight','demo_confirm_empty_and_finish',
 'simulate_driver_resume','incident','resolve_incident'
]);
const CROSS_ROLE=new Set([
 'start_demo_trip','simulate_arrival','simulate_driver_resume',
 'demo_confirm_empty_and_finish','resolve_incident'
]);
export function inspectAttendantGesture({mode='demo',action,studentId=null}={}){
 if(mode!=='demo')return Object.freeze({ok:false,code:'OPERATIONAL_DISPATCH_DISABLED'});
 if(!DEMO_ACTIONS.has(action))return Object.freeze({ok:false,code:'UNMAPPED_OR_NAVIGATION'});
 if(['board','mark_absent','alight'].includes(action)&&
    (typeof studentId!=='string'||studentId.length===0))
   return Object.freeze({ok:false,code:'STUDENT_CONTEXT_REQUIRED'});
 return Object.freeze({ok:true,code:'DEMO_GESTURE_ONLY',
   isSyntheticCrossRole:CROSS_ROLE.has(action),dispatchEnabled:false});
}
