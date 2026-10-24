/** SYNC-19 — Standalone demo-only attendant workflow. No network access or real identities. */
import {authorizeAttendant} from '../mobile-session18/attendant-policy.mjs';
const freeze=x=>Object.freeze(x);
export function makeAttendantDemo(){
 return {mode:'demo',role:'attendant',session:{ok:true,mode:'demo',role:'attendant',attendantId:'ATT-DEMO'},
 trip:{id:'TRIP-DEMO',mode:'demo',attendantId:'ATT-DEMO',status:'planned',onboardCount:0},
 students:[{id:'E-01',tripId:'TRIP-DEMO',mode:'demo',absent:false,boarded:false,alighted:false},{id:'E-02',tripId:'TRIP-DEMO',mode:'demo',absent:false,boarded:false,alighted:false}],
 network:'simulated-online',presence:false,events:[],nextId:1,alert:null};
}
const clone=s=>structuredClone(s);
const count=s=>s.students.filter(x=>x.boarded&&!x.alighted).length;
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
export function runAttendantDemo(state,action,{studentId=null,incident=null}={}){
 const s=clone(state);
 if(!s||s.mode!=='demo')throw Error('DEMO_ONLY');
 if(action==='start_demo_trip'){
  if(!s.presence||s.trip.status!=='planned')throw Error('DEPARTURE_NOT_AUTHORIZED');
  // Simulator starts a synthetic trip; attendant is not granted operational driver controls.
  s.trip.status='in_progress';return write(s,'synthetic_trip_started');
 }
 if(action==='confirm_presence'){
  ensure(s,'confirm_presence');if(s.presence)throw Error('ALREADY_CONFIRMED');
  s.presence=true;return write(s,'presence_confirmed');
 }
 if(action==='board'||action==='alight'){
  const student=s.students.find(x=>x.id===studentId);
  ensure(s,action,student);
  if(action==='board')student.boarded=true;
  else student.alighted=true;
  // A pointage after a final check invalidates that check.
  s.events=s.events.filter(e=>e.type!=='empty_bus_confirmed');
  return write(s,action,studentId);
 }
 if(action==='report_incident'){
  ensure(s,'report_incident');
  if(typeof incident!=='string'||!['delay','breakdown','accident','medical','missing_child','other'].includes(incident))throw Error('INVALID_INCIDENT');
  s.alert=incident;return write(s,'incident_'+incident);
 }
 if(action==='confirm_empty'){
  ensure(s,'confirm_empty');return write(s,'empty_bus_confirmed');
 }
 if(action==='simulate_network_loss'||action==='simulate_network_return'){
  s.network=action==='simulate_network_loss'?'simulated-offline':'simulated-online';
  return s;
 }
 if(action==='finish_demo_trip'){
  if(s.trip.status!=='in_progress'||count(s)!==0)throw Error('FINISH_BLOCKED');
  if(!s.events.some(e=>e.type==='empty_bus_confirmed'))throw Error('EMPTY_BUS_CONFIRMATION_REQUIRED');
  s.trip.status='completed';return write(s,'synthetic_trip_finished');
 }
 throw Error('ACTION_DENIED');
}
export function attendantSummary(s){return freeze({mode:'demo',status:s.trip.status,presence:s.presence,assigned:s.students.length,onboard:count(s),alighted:s.students.filter(x=>x.alighted).length,pendingRealSync:0,events:s.events.length,network:s.network});}
