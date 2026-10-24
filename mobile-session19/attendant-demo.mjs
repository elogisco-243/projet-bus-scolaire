/** UI-154 — isolated DEMO-only attendant process. Never controls an operational bus. */
import {authorizeAttendant} from '../mobile-session18/attendant-policy.mjs';
const freeze=x=>Object.freeze(x);
const itinerary=()=>[
 {id:'STOP-01',name:'Dépôt',reached:false},
 {id:'STOP-02',name:'Arrêt fictif A',reached:false},
 {id:'STOP-03',name:'Arrêt fictif B',reached:false}
];
export const INCIDENTS=Object.freeze([
 ['Embouteillage','traffic'],['Retard','delay'],['Panne','breakdown'],
 ['Accident','accident'],['Urgence médicale','medical'],['Enfant manquant','missing_child']
]);
export function makeAttendantDemo(){
 return {mode:'demo',role:'attendant',session:{ok:true,mode:'demo',role:'attendant',attendantId:'ATT-DEMO'},
 trip:{id:'TRIP-DEMO',mode:'demo',attendantId:'ATT-DEMO',status:'planned',onboardCount:0},
 students:[
  {id:'E-01',tripId:'TRIP-DEMO',mode:'demo',absent:false,boarded:false,alighted:false},
  {id:'E-02',tripId:'TRIP-DEMO',mode:'demo',absent:false,boarded:false,alighted:false}
 ],
 stops:itinerary(),network:'simulated-online',presence:false,
 driverSecured:false,ready:false,events:[],nextId:1,alert:null};
}
const clone=s=>structuredClone(s);
const count=s=>s.students.filter(x=>x.boarded&&!x.alighted).length;
const unaccounted=s=>s.students.filter(x=>!x.absent&&!(x.boarded&&x.alighted)).length;
function write(s,type,studentId=null){
 s.trip.onboardCount=count(s);
 s.events.push({id:'DEMO-EVT-'+s.nextId++,type,studentId,mode:'demo',delivery:'LOCAL_SIMULATION_ONLY'});
 return s;
}
function ensure(s,action,student=null){
 if(s?.mode!=='demo'||s?.session?.mode!=='demo')throw Error('DEMO_ONLY');
 const result=authorizeAttendant({session:s.session,trip:s.trip,action,student,eventMode:'demo'});
 if(!result.allowed)throw Error(result.code);
}
const requireStop=s=>{if(!s.driverSecured)throw Error('VEHICLE_NOT_SECURED');};
export function runAttendantDemo(state,action,{studentId=null,incident=null}={}){
 const s=clone(state);
 if(!s||s.mode!=='demo'||s.session?.mode!=='demo')throw Error('DEMO_ONLY');
 if(action==='simulate_driver_secure'){
  if(!['planned','in_progress'].includes(s.trip.status))throw Error('TRIP_NOT_ACTIVE');
  // Synthetic driver event, not an attendant authorization or a real driver confirmation.
  s.driverSecured=true;
  return write(s,'synthetic_driver_secured');
 }
 if(action==='simulate_driver_resume'){
  if(s.trip.status!=='in_progress')throw Error('TRIP_NOT_ACTIVE');
  s.driverSecured=false;
  return write(s,'synthetic_driver_resumed');
 }
 if(action==='toggle_ready'){
  if(s.trip.status!=='planned'||!s.presence||!s.driverSecured)throw Error('READY_PRECONDITIONS_NOT_MET');
  s.ready=!s.ready;
  return write(s,s.ready?'demo_ready_confirmed':'demo_ready_cancelled');
 }
 if(action==='start_demo_trip'){
  if(!s.presence||!s.driverSecured||!s.ready||s.trip.status!=='planned')throw Error('DEPARTURE_NOT_AUTHORIZED');
  // Synthetic trip; attendant receives no operational start/vehicle privileges.
  s.trip.status='in_progress';s.ready=false;s.driverSecured=false;
  return write(s,'synthetic_trip_started');
 }
 if(action==='confirm_presence'){
  ensure(s,'confirm_presence');if(s.presence)throw Error('ALREADY_CONFIRMED');
  s.presence=true;return write(s,'presence_confirmed');
 }
 if(action==='board'||action==='alight'||action==='mark_absent'){
  const student=s.students.find(x=>x.id===studentId);
  ensure(s,action,student);requireStop(s);
  if(action==='board')student.boarded=true;
  else if(action==='alight')student.alighted=true;
  else {if(student.boarded)throw Error('ALREADY_BOARDED');student.absent=true;}
  // Any pointage change invalidates previous final empty-bus confirmation.
  s.events=s.events.filter(e=>e.type!=='empty_bus_confirmed');
  return write(s,action,studentId);
 }
 if(action==='reach_stop'){
  ensure(s,'mark_stop');requireStop(s);
  const stop=s.stops.find(x=>!x.reached);
  if(!stop)throw Error('ALL_STOPS_REACHED');
  stop.reached=true;
  s.driverSecured=false; // each new stop requires a separate synthetic stationary signal
  return write(s,'stop_reached_'+stop.id);
 }
 if(action==='report_incident'){
  ensure(s,'report_incident');requireStop(s);
  if(!INCIDENTS.some(x=>x[1]===incident))throw Error('INVALID_INCIDENT');
  s.alert=incident;return write(s,'incident_'+incident);
 }
 if(action==='confirm_empty'){
  ensure(s,'confirm_empty');requireStop(s);
  if(s.events.some(e=>e.type==='empty_bus_confirmed'))throw Error('ALREADY_CONFIRMED');
  return write(s,'empty_bus_confirmed');
 }
 if(action==='simulate_network_loss'||action==='simulate_network_return'){
  s.network=action==='simulate_network_loss'?'simulated-offline':'simulated-online';
  return s;
 }
 if(action==='finish_demo_trip'){
  if(s.trip.status!=='in_progress'||count(s)!==0)throw Error('FINISH_BLOCKED');
  requireStop(s);
  if(s.stops.some(x=>!x.reached))throw Error('ROUTE_NOT_COMPLETED');
  if(unaccounted(s)!==0)throw Error('STUDENTS_NOT_RECONCILED');
  if(!s.events.some(e=>e.type==='empty_bus_confirmed'))throw Error('EMPTY_BUS_CONFIRMATION_REQUIRED');
  s.trip.status='completed';return write(s,'synthetic_trip_finished');
 }
 throw Error('ACTION_DENIED');
}
export function attendantSummary(s){
 return freeze({
  mode:'demo',status:s.trip.status,presence:s.presence,
  assigned:s.students.length,onboard:count(s),alighted:s.students.filter(x=>x.alighted).length,
  unaccounted:unaccounted(s),nextStop:s.stops.find(x=>!x.reached)?.name||'Terminus atteint',
  stopsReached:s.stops.filter(x=>x.reached).length,stopsTotal:s.stops.length,
  ready:s.ready,driverSecured:s.driverSecured,
  canToggleReady:s.trip.status==='planned'&&s.presence&&s.driverSecured,
  canReportIncidents:s.trip.status==='in_progress'&&s.driverSecured,
  pendingRealSync:0,events:s.events.length,network:s.network
 });
}
