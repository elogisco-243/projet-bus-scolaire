/** UI-188: four-role DEMO workflow reducer. Pure state; no real credentials or external dispatch.
 * Original UI-178 app.mjs/style.css and historical Chauffeur UI are NOT modified.
 */
import {createGolfDemoSnapshot,validateGolfSnapshot,projectGolfDemo,GOLF_ROUTE} from './golf-route-adapter.mjs';
const deny=(code)=>Object.freeze({ok:false,code});
const allowedRoles=['driver','attendant','parent','supervisor'];
const actions={
 driver:['secure_vehicle','start_trip','arrive_stop','resume_trip','finish_trip','report_incident'],
 attendant:['check_in','ready_departure','board','alight','mark_absent','confirm_empty','report_incident'],
 parent:['acknowledge_notification'],
 supervisor:['resolve_incident','review_trip']
};
export function createFourRoleDemo(){
 return {...createGolfDemoSnapshot(),version:1,atStop:false,secured:false,
  driverReady:false,attendantPresent:false,attendantReady:false,inspectionConfirmed:false,
  notifications:[],events:[],nextEventId:1,tripReviewed:false};
}
const active=s=>s.status==='in_progress';
const onboard=s=>s.students.filter(p=>p.boarded&&!p.alighted);
const log=(s,role,action,payload={})=>{
 const event={id:'DEMO-'+s.nextEventId++,revision:s.revision+1,role,action,...payload};
 s.events.push(event);s.revision++;return {ok:true,snapshot:s,event};
};
export function executeFourRoleDemo(input,{role,action,studentId=null,kind=null,incidentId=null,reason=null}={}){
 if(!allowedRoles.includes(role))return deny('ROLE_UNKNOWN');
 if(!actions[role].includes(action))return deny('ROLE_ACTION_FORBIDDEN');
 if(!input||input.mode!=='demo'||input.version!==1)return deny('DEMO_ONLY');
 const validated=validateGolfSnapshot(input);
 if(!validated.ok)return validated;
 const s=structuredClone(input);
 if(!Array.isArray(s.events)||!Array.isArray(s.notifications)||!Number.isSafeInteger(s.nextEventId))
  return deny('INVALID_WORKFLOW_CONTEXT');
 const pupil=s.students.find(p=>p.id===studentId);
 const next=s.stops.find(p=>!p.reached);
 const securedStop=()=>s.atStop&&s.secured&&s.currentStopId&&s.stops.some(p=>p.id===s.currentStopId&&p.reached);
 const openIncidents=()=>s.incidents.some(p=>p.status==='open');
 switch(action){
 case 'check_in':
  if(s.status!=='planned')return deny('TRIP_ALREADY_STARTED');
  s.attendantPresent=true;return log(s,role,action);
 case 'secure_vehicle':
  if(s.status==='completed')return deny('TRIP_COMPLETED');
  s.secured=true;return log(s,role,action);
 case 'ready_departure':
  if(s.status!=='planned'||!s.attendantPresent||!s.secured)return deny('DEPARTURE_NOT_READY');
  s.attendantReady=true;return log(s,role,action);
 case 'start_trip':
  if(s.status!=='planned')return deny('TRIP_NOT_PLANNED');
  if(!s.secured||!s.attendantPresent||!s.attendantReady)return deny('DEPARTURE_NOT_READY');
  if(openIncidents())return deny('OPEN_INCIDENTS');
  s.status='in_progress';s.driverReady=true;s.atStop=false;s.secured=false;
  return log(s,role,action);
 case 'arrive_stop':
  if(!active(s)||!next)return deny('NO_ACTIVE_STOP');
  if(!s.secured)return deny('VEHICLE_NOT_SECURED');
  if(openIncidents())return deny('OPEN_INCIDENTS');
  if(s.atStop)return deny('ALREADY_AT_STOP');
  next.reached=true;s.currentStopId=next.id;s.atStop=true;s.inspectionConfirmed=false;
  return log(s,role,action,{stopId:next.id});
 case 'resume_trip':
  if(!active(s)||!securedStop())return deny('STOP_NOT_SECURED');
  if(!next)return deny('TERMINUS_REACHED');
  if(openIncidents())return deny('OPEN_INCIDENTS');
  const pending=s.students.some(p=>(p.pickupStopId===s.currentStopId&&!p.boarded&&!p.absent)
    ||(p.dropoffStopId===s.currentStopId&&p.boarded&&!p.alighted));
  if(pending)return deny('POINTAGE_PENDING');
  s.atStop=false;s.secured=false;return log(s,role,action);
 case 'board':
 case 'alight':
 case 'mark_absent':
  if(!active(s)||!securedStop())return deny('STOP_NOT_SECURED');
  if(!pupil)return deny('STUDENT_UNKNOWN');
  if(action==='board'){
   if(pupil.absent||pupil.boarded)return deny('DUPLICATE_OR_ABSENT');
   if(pupil.pickupStopId!==s.currentStopId)return deny('WRONG_PICKUP_STOP');
   pupil.boarded=true;
  }else if(action==='alight'){
   if(!pupil.boarded||pupil.alighted)return deny('STUDENT_NOT_ONBOARD');
   if(pupil.dropoffStopId!==s.currentStopId)return deny('WRONG_DROPOFF_STOP');
   pupil.alighted=true;
  }else{
   if(pupil.boarded||pupil.absent)return deny('ABSENCE_ALREADY_RESOLVED');
   if(pupil.pickupStopId!==s.currentStopId)return deny('WRONG_PICKUP_STOP');
   if(!['non_present','family_notified'].includes(reason))return deny('ABSENCE_REASON_REQUIRED');
   pupil.absent=true;pupil.absenceReason=reason;
  }
  s.notifications.push({id:'DEMO-N-'+s.nextEventId,studentId,action,status:'unread'});
  return log(s,role,action,{studentId,stopId:s.currentStopId});
 case 'report_incident':
  if(s.status==='completed')return deny('TRIP_COMPLETED');
  if(!['traffic','delay','breakdown','accident','medical','missing_child'].includes(kind))return deny('INCIDENT_UNKNOWN');
  if(role==='attendant'&&!['medical','missing_child','accident'].includes(kind)&&!securedStop())
   return deny('STOP_NOT_SECURED');
  const incident={id:'DEMO-I-'+s.nextEventId,kind,status:'open',stopId:s.currentStopId};
  s.incidents.push(incident);return log(s,role,action,{incidentId:incident.id});
 case 'resolve_incident':
  if(!s.secured)return deny('VEHICLE_NOT_SECURED');
  const incidentFound=s.incidents.find(p=>p.id===incidentId&&p.status==='open');
  if(!incidentFound)return deny('INCIDENT_NOT_OPEN');
  incidentFound.status='resolved_demo';return log(s,role,action,{incidentId});
 case 'confirm_empty':
  if(!active(s)||!securedStop()||next)return deny('NOT_AT_TERMINUS');
  if(onboard(s).length)return deny('CHILDREN_REMAIN');
  if(s.students.some(p=>!p.absent&&!(p.boarded&&p.alighted)))return deny('STUDENTS_NOT_RECONCILED');
  if(openIncidents())return deny('OPEN_INCIDENTS');
  s.inspectionConfirmed=true;return log(s,role,action);
 case 'finish_trip':
  if(!active(s)||!securedStop()||next)return deny('ROUTE_NOT_COMPLETED');
  if(!s.inspectionConfirmed)return deny('FINAL_INSPECTION_REQUIRED');
  if(onboard(s).length)return deny('CHILDREN_REMAIN');
  if(openIncidents())return deny('OPEN_INCIDENTS');
  s.status='completed';return log(s,role,action);
 case 'acknowledge_notification':
  if(!studentId)return deny('STUDENT_CONTEXT_REQUIRED');
  const notification=s.notifications.find(p=>p.studentId===studentId&&p.status==='unread');
  if(!notification)return deny('NO_NOTIFICATION');
  notification.status='read_demo';return log(s,role,action,{studentId});
 case 'review_trip':
  if(s.status!=='completed')return deny('TRIP_NOT_COMPLETED');
  s.tripReviewed=true;return log(s,role,action);
 }
 return deny('ACTION_NOT_MAPPED');
}
export function fourRoleDemoView(snapshot,role,{parentStudentIds=[]}={}){
 const base=projectGolfDemo(snapshot,role);
 if(!base.ok)return base;
 if(role==='parent'){
  // A demo relationship is explicit; do not reveal other students.
  const scope=new Set(parentStudentIds.filter(id=>GOLF_ROUTE.pupils.some(p=>p.id===id)));
  return Object.freeze({...base,students:base.students.filter(p=>scope.has(p.id)),
   notifications:(snapshot.notifications||[]).filter(p=>scope.has(p.studentId))});
 }
 if(role==='supervisor')return Object.freeze({...base,
  incidents:(snapshot.incidents||[]).map(p=>({...p})),reviewed:snapshot.tripReviewed===true});
 return Object.freeze({...base,canReport:true,atStop:snapshot.atStop===true,
  secured:snapshot.secured===true,inspectionConfirmed:snapshot.inspectionConfirmed===true});
}
export function fourRoleOperationalDispatch(){return deny('OPERATIONAL_DISPATCH_DISABLED');}
