/** UI-182: advanced DRIVER parity rules, DEMO-only, pure and fail-closed.
 * Reuses the established UI-160 stop/student/closure checks; does NOT
 * grant authority from local role flags or synchronize independent APKs.
 * This is NOT a replacement for the user's approved complete Chauffeur UI.
 */
import {checkStudentAtStop,checkClosure,fail,permit,verifyCrossRoleApproval}
 from './shared-trip-contract.mjs';

const hasIdentity=s=>s?.mode==='demo'&&s?.role==='driver'&&
 s?.session?.mode==='demo'&&s?.session?.role==='driver';

export function driverAdvancedDecision(s,action,{studentId=null,inspectionConfirmed=false}={}){
 if(!hasIdentity(s))return fail('DRIVER_DEMO_CONTEXT_REQUIRED');
 if(s.trip?.id==null||!Array.isArray(s.stops)||!Array.isArray(s.students))return fail('INVALID_TRIP_CONTEXT');
 const active=s.trip.status==='in_progress';
 const completed=s.trip.status==='closed';
 const parked=s.parked===true;
 const alerts=Array.isArray(s.alerts)?s.alerts.filter(a=>a.status==='open').length:Infinity;
 const stopContext={started:active,completed,parked,atStop:s.atStop===true,
  activeStopId:s.activeStopId??null,stops:s.stops};
 switch(action){
  case 'begin':
   if(s.trip.status!=='planned')return fail('TRIP_NOT_PLANNED');
   if(!parked||s.ready!==true)return fail('DEPARTURE_NOT_SECURED');
   if(alerts>0)return fail('OPEN_INCIDENTS');
   if(s.crew?.mode==='paired'&&s.crew.attendantPresent!==true)
     return fail('ATTENDANT_NOT_PRESENT');
   if(s.crew?.mode==='replacement'&&s.crew.replacementAuthorized!==true)
     return fail('REPLACEMENT_NOT_AUTHORIZED');
   if(s.crew?.mode==='solo'&&
       (s.crew.soloAuthorized!==true||s.crew.attendantMandatory===true))
     return fail('SOLO_NOT_AUTHORIZED');
   if(!['paired','replacement','solo'].includes(s.crew?.mode))
     return fail('CREW_MODE_UNKNOWN');
   return permit();
  case 'arrive':
   if(!active)return fail('TRIP_NOT_ACTIVE');
   if(!parked)return fail('VEHICLE_NOT_SECURED_AT_STOP');
   if(alerts>0)return fail('OPEN_INCIDENTS');
   if(!s.stops.some(p=>p.reached!==true))return fail('ROUTE_NOT_COMPLETED');
   return permit();
  case 'board':
  case 'alight':
  case 'mark_absent':{
   const student=s.students.find(p=>p.id===studentId);
   return checkStudentAtStop({...stopContext,student,action});
  }
  case 'close-trip':
   return checkClosure({...stopContext,students:s.students,unresolvedAlerts:alerts,
    inspectionConfirmed:inspectionConfirmed===true});
  case 'new-trip':
   return completed?permit():fail('PREVIOUS_TRIP_NOT_CLOSED');
  case 'cross-role-approval':
   return verifyCrossRoleApproval();
  default:
   return fail('ACTION_NOT_MAPPED');
 }
}
export function driverOperationalDecision(){return fail('OPERATIONAL_DISPATCH_DISABLED');}
