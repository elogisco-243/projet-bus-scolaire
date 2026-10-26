/** UI-155: isolated, ephemeral attendant DEMO. No operational server or vehicle action. */
import {authorizeAttendant} from '../mobile-session18/attendant-policy.mjs';
import {checkStudentAtStop,checkClosure} from './shared-trip-contract.mjs';
const freeze=Object.freeze;
export const CRITICAL_INCIDENTS=freeze(['accident','medical','missing_child']);
export const INCIDENTS=freeze([
 ['Embouteillage','traffic'],['Retard','delay'],['Panne','breakdown'],
 ['Accident','accident'],['Urgence médicale','medical'],['Enfant manquant','missing_child']
]);
const itinerary=()=>[
 {id:'STOP-01',name:'Dépôt',reached:false},
 {id:'STOP-02',name:'Arrêt fictif A',reached:false},
 {id:'STOP-03',name:'Arrêt fictif B',reached:false}
];
const pupil=(id,pickupStopId,dropoffStopId)=>({
 id,tripId:'TRIP-DEMO',mode:'demo',pickupStopId,dropoffStopId,
 absent:false,absenceReason:null,boarded:false,alighted:false
});
export function makeAttendantDemo(){
 return {mode:'demo',role:'attendant',session:{ok:true,mode:'demo',role:'attendant',attendantId:'ATT-DEMO'},
 trip:{id:'TRIP-DEMO',mode:'demo',attendantId:'ATT-DEMO',status:'planned',onboardCount:0},
 students:[pupil('E-01','STOP-01','STOP-03'),pupil('E-02','STOP-02','STOP-03')],
 stops:itinerary(),network:'simulated-online',presence:false,driverSecured:false,
 ready:false,atStop:false,activeStopId:null,alerts:[],events:[],nextId:1,alert:null};
}
const clone=s=>structuredClone(s);
const count=s=>s.students.filter(p=>p.boarded&&!p.alighted).length;
const unaccounted=s=>s.students.filter(p=>!p.absent&&!(p.boarded&&p.alighted)).length;
const pendingAtStop=s=>s.atStop?s.students.filter(p=>
 (p.pickupStopId===s.activeStopId&&!p.absent&&!p.boarded)||
 (p.dropoffStopId===s.activeStopId&&p.boarded&&!p.alighted)
).length:0;
const openAlerts=s=>s.alerts.filter(a=>a.status==='open').length;
function write(s,type,studentId=null){
 s.trip.onboardCount=count(s);
 s.events.push({id:'DEMO-EVT-'+s.nextId++,type,studentId,stopId:s.activeStopId,
  mode:'demo',delivery:'LOCAL_SIMULATION_ONLY'});
 return s;
}
function ensure(s,action,student=null){
 if(s?.mode!=='demo'||s?.session?.mode!=='demo')throw Error('DEMO_ONLY');
 const r=authorizeAttendant({session:s.session,trip:s.trip,action,student,eventMode:'demo'});
 if(!r.allowed)throw Error(r.code);
}
function requireActiveStop(s){
 if(!s.atStop||!s.activeStopId||!s.driverSecured)throw Error('VEHICLE_NOT_SECURED_AT_STOP');
}
function nextStop(s){return s.stops.find(p=>!p.reached);}
export function attendantClosingChecklist(s){
 const last=s.stops.at(-1);
 return freeze([
  {id:'stops',label:'Tous les arrêts atteints',ok:s.stops.every(p=>p.reached)},
  {id:'students',label:'Chaque élève est justifié',ok:unaccounted(s)===0},
  {id:'onboard',label:'Aucun élève à bord',ok:count(s)===0},
  {id:'alerts',label:'Incidents traités dans la simulation',ok:openAlerts(s)===0},
  {id:'safety',label:'Bus arrêté au terminus',ok:!!last&&s.activeStopId===last.id&&s.atStop&&s.driverSecured},
  {id:'empty',label:'Inspection finale du bus confirmée',ok:s.events.some(e=>e.type==='empty_bus_confirmed')}
 ]);
}
export function attendantSummary(s){
 const close=attendantClosingChecklist(s);
 return freeze({
  mode:'demo',status:s.trip.status,presence:s.presence,
  assigned:s.students.length,onboard:count(s),alighted:s.students.filter(p=>p.alighted).length,
  unaccounted:unaccounted(s),nextStop:nextStop(s)?.name||'Terminus atteint',
  stopsReached:s.stops.filter(p=>p.reached).length,stopsTotal:s.stops.length,
  activeStopId:s.activeStopId,activeStopName:s.stops.find(p=>p.id===s.activeStopId)?.name||'',
  atStop:s.atStop,pendingAtStop:pendingAtStop(s),openAlerts:openAlerts(s),
  ready:s.ready,driverSecured:s.driverSecured,
  canToggleReady:s.trip.status==='planned'&&s.presence&&s.driverSecured,
  canDemoPrepare:s.trip.status==='planned',
  canOpenClosing:s.trip.status==='in_progress'&&s.atStop&&s.driverSecured&&
   s.stops.every(p=>p.reached)&&unaccounted(s)===0&&count(s)===0&&openAlerts(s)===0,
  canStart:s.trip.status==='planned'&&s.presence&&s.driverSecured&&s.ready&&openAlerts(s)===0,
  canReportIncidents:s.trip.status==='in_progress'&&s.atStop&&s.driverSecured,
  canSimulateArrival:s.trip.status==='in_progress'&&!s.atStop&&!!nextStop(s),
  canResume:s.trip.status==='in_progress'&&s.atStop&&pendingAtStop(s)===0&&!!nextStop(s)&&!s.alerts.some(a=>a.status==='open'&&a.critical),
  canConfirmEmpty:s.trip.status==='in_progress'&&s.atStop&&s.driverSecured&&count(s)===0,
  canFinish:s.trip.status==='in_progress'&&close.every(x=>x.ok),
  closure:close,pendingRealSync:0,events:s.events.length,network:s.network
 });
}
export function runAttendantDemo(state,action,{studentId=null,incident=null,incidentId=null,reason=null}={}){
 const s=clone(state);
 if(!s||s.mode!=='demo'||s.session?.mode!=='demo')throw Error('DEMO_ONLY');
 // UI-158: one explicit readiness switch replaces three fictitious setup commands.
 // Isolated DEMO: records synthetic preparation only, NEVER a real Chauffeur approval.
 if(action==='demo_prepare_departure'){
  ensure(s,'confirm_presence');
  if(s.trip.status!=='planned')throw Error('TRIP_NOT_PLANNED');
  if(openAlerts(s)!==0)throw Error('OPEN_INCIDENTS');
  if(s.ready){s.ready=false;return write(s,'demo_ready_cancelled');}
  s.presence=true;s.driverSecured=true;s.ready=true;
  return write(s,'synthetic_joint_preparation_demo_only');
 }
 // A single explicit final inspection confirmation replaces duplicate closing steps.
 if(action==='demo_confirm_empty_and_finish'){
  if(s.trip.status!=='in_progress')throw Error('TRIP_NOT_ACTIVE');
  requireActiveStop(s);
  if(s.stops.some(p=>!p.reached))throw Error('ROUTE_NOT_COMPLETED');
  if(unaccounted(s)!==0)throw Error('STUDENTS_NOT_RECONCILED');
  if(count(s)!==0)throw Error('CHILDREN_REMAIN');
  ensure(s,'confirm_empty');
  if(openAlerts(s)!==0)throw Error('OPEN_INCIDENTS');
  if(s.events.some(e=>e.type==='empty_bus_confirmed'))throw Error('ALREADY_CONFIRMED');
  const closure=checkClosure({
   started:true,parked:s.driverSecured,atStop:s.atStop,activeStopId:s.activeStopId,
   stops:s.stops,students:s.students,unresolvedAlerts:openAlerts(s),
   inspectionConfirmed:true // explicit action in this branch records that inspection
  });
  if(!closure.ok)throw Error(closure.code);
  write(s,'empty_bus_confirmed');
  if(!attendantClosingChecklist(s).every(x=>x.ok))throw Error('FINISH_BLOCKED');
  const final=checkClosure({
   started:true,parked:s.driverSecured,atStop:s.atStop,activeStopId:s.activeStopId,
   stops:s.stops,students:s.students,unresolvedAlerts:openAlerts(s),
   inspectionConfirmed:s.events.some(e=>e.type==='empty_bus_confirmed')
  });
  if(!final.ok)throw Error(final.code);
  s.trip.status='completed';return write(s,'synthetic_trip_finished');
 }
 if(action==='confirm_presence'){
  ensure(s,'confirm_presence');if(s.presence)throw Error('ALREADY_CONFIRMED');
  s.presence=true;return write(s,'presence_confirmed');
 }
 if(action==='simulate_driver_secure'){
  if(!['planned','in_progress'].includes(s.trip.status))throw Error('TRIP_NOT_ACTIVE');
  // DEMO-only synthetic Chauffeur event. Never a real attendant vehicle control.
  s.driverSecured=true;
  return write(s,'synthetic_driver_secured');
 }
 if(action==='simulate_driver_resume'){
  if(s.trip.status!=='in_progress'||!s.atStop)throw Error('NO_ACTIVE_STOP');
  if(pendingAtStop(s)!==0)throw Error('POINTAGE_PENDING_AT_STOP');
  if(s.alerts.some(a=>a.status==='open'&&a.critical))throw Error('OPEN_CRITICAL_INCIDENT');
  if(!nextStop(s))throw Error('ALREADY_AT_TERMINUS');
  s.atStop=false;s.activeStopId=null;s.driverSecured=false;
  return write(s,'synthetic_driver_resumed');
 }
 if(action==='toggle_ready'){
  if(s.trip.status!=='planned'||!s.presence||!s.driverSecured)throw Error('READY_PRECONDITIONS_NOT_MET');
  s.ready=!s.ready;
  return write(s,s.ready?'demo_ready_confirmed':'demo_ready_cancelled');
 }
 if(action==='start_demo_trip'){
  if(!s.presence||!s.driverSecured||!s.ready||s.trip.status!=='planned')throw Error('DEPARTURE_NOT_AUTHORIZED');
  if(openAlerts(s)!==0)throw Error('OPEN_INCIDENTS');
  s.trip.status='in_progress';s.ready=false;s.driverSecured=false;
  return write(s,'synthetic_trip_started');
 }
 if(action==='simulate_arrival'||action==='reach_stop'){
  ensure(s,'mark_stop');
  if(s.atStop)throw Error('STOP_CURRENTLY_ACTIVE');
  // UI-155 one simulated Chauffeur arrival event; includes standstill and route advance.
  // No real vehicle control and no actual GPS validation.
  if(action==='reach_stop'&&!s.driverSecured)throw Error('VEHICLE_NOT_SECURED');
  const stop=nextStop(s);
  if(!stop)throw Error('ALL_STOPS_REACHED');
  stop.reached=true;s.atStop=true;s.activeStopId=stop.id;s.driverSecured=true;
  return write(s,'synthetic_arrival_'+stop.id);
 }
 if(action==='board'||action==='alight'||action==='mark_absent'){
  const p=s.students.find(x=>x.id===studentId);
  ensure(s,action,p);requireActiveStop(s);
  // UI-160: same stop/assignment safety preflight as the future shared domain.
  const admission=checkStudentAtStop({
   started:s.trip.status==='in_progress',completed:s.trip.status==='completed',
   parked:s.driverSecured,atStop:s.atStop,activeStopId:s.activeStopId,
   stops:s.stops,student:p,action
  });
  if(!admission.ok){
   if(admission.code==='PUPIL_WRONG_STOP')throw Error(action==='alight'?'WRONG_DROPOFF_STOP':'WRONG_PICKUP_STOP');
   throw Error(admission.code);
  }
  if(action==='board'){
   if(p.pickupStopId!==s.activeStopId)throw Error('WRONG_PICKUP_STOP');
   p.boarded=true;
  }else if(action==='alight'){
   if(p.dropoffStopId!==s.activeStopId)throw Error('WRONG_DROPOFF_STOP');
   p.alighted=true;
  }else{
   if(p.pickupStopId!==s.activeStopId)throw Error('WRONG_PICKUP_STOP');
   if(!['non_present','family_notified'].includes(reason))throw Error('ABSENCE_REASON_REQUIRED');
   p.absent=true;p.absenceReason=reason;
  }
  s.events=s.events.filter(e=>e.type!=='empty_bus_confirmed');
  return write(s,action,p.id);
 }
 // UI-163 — Undo only the immediately preceding pupil action at the same parked stop.
 // Never erase the previous audit event; append a compensating event instead.
 if(action==='undo_last_pointage'){
  if(s.trip.status!=='in_progress')throw Error('TRIP_NOT_ACTIVE');
  requireActiveStop(s);
  const previous=s.events.at(-1);
  if(!previous||!['board','alight','mark_absent'].includes(previous.type)||
    previous.stopId!==s.activeStopId)throw Error('NO_REVERSIBLE_POINTAGE');
  const pupil=s.students.find(p=>p.id===previous.studentId);
  if(!pupil)throw Error('STUDENT_NOT_ON_TRIP');
  ensure(s,'view_trip',pupil);
  if(previous.type==='board'){
   if(!pupil.boarded||pupil.alighted)throw Error('UNDO_NOT_SAFE');
   pupil.boarded=false;
  }else if(previous.type==='alight'){
   if(!pupil.alighted||!pupil.boarded)throw Error('UNDO_NOT_SAFE');
   pupil.alighted=false;
  }else{
   if(!pupil.absent||pupil.boarded)throw Error('UNDO_NOT_SAFE');
   pupil.absent=false;pupil.absenceReason=null;
  }
  return write(s,'pointage_reverted',pupil.id);
 }
 if(action==='report_incident'){
  if(!INCIDENTS.some(x=>x[1]===incident))throw Error('INVALID_INCIDENT');
  const critical=CRITICAL_INCIDENTS.includes(incident);
  // Critical report is accessible without a standstill; it NEVER triggers real help.
  ensure(s,critical?'view_trip':'report_incident');
  if(s.trip.status==='completed')throw Error('TRIP_COMPLETED');
  if(!critical)requireActiveStop(s);
  const id='INC-DEMO-'+s.nextId;
  s.alert=incident;
  s.alerts.push({id,kind:incident,critical,status:'open',stopId:s.activeStopId,delivery:'LOCAL_SIMULATION_ONLY'});
  return write(s,'incident_'+incident);
 }
 if(action==='resolve_incident'){
  // PRE-DEPARTURE: a critical event can be acknowledged as simulated only once
  // synthetic Chauffeur safety has been recorded, not while driving.
  ensure(s,s.trip.status==='planned'?'view_trip':'report_incident');
  if(s.trip.status==='planned'){
   if(!s.driverSecured)throw Error('VEHICLE_NOT_SECURED');
  }else requireActiveStop(s);
  const a=s.alerts.find(x=>x.id===incidentId);
  if(!a||a.status!=='open')throw Error('INCIDENT_NOT_OPEN');
  a.status='resolved_demo';
  return write(s,'incident_resolved_'+a.kind);
 }
 if(action==='confirm_empty'){
  ensure(s,'confirm_empty');requireActiveStop(s);
  if(count(s)!==0)throw Error('CHILDREN_REMAIN');
  if(s.events.some(e=>e.type==='empty_bus_confirmed'))throw Error('ALREADY_CONFIRMED');
  if(s.stops.some(p=>!p.reached))throw Error('ROUTE_NOT_COMPLETED');
  return write(s,'empty_bus_confirmed');
 }
 if(action==='simulate_network_loss'||action==='simulate_network_return'){
  s.network=action==='simulate_network_loss'?'simulated-offline':'simulated-online';
  return s;
 }
 if(action==='finish_demo_trip'){
  if(s.trip.status!=='in_progress'||count(s)!==0)throw Error('FINISH_BLOCKED');
  requireActiveStop(s);
  if(s.stops.some(p=>!p.reached))throw Error('ROUTE_NOT_COMPLETED');
  if(unaccounted(s)!==0)throw Error('STUDENTS_NOT_RECONCILED');
  if(openAlerts(s)!==0)throw Error('OPEN_INCIDENTS');
  if(!s.events.some(e=>e.type==='empty_bus_confirmed'))throw Error('EMPTY_BUS_CONFIRMATION_REQUIRED');
  s.trip.status='completed';return write(s,'synthetic_trip_finished');
 }
 throw Error('ACTION_DENIED');
}
