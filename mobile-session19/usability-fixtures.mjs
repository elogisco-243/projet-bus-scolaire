/**
 * UI-166: fictitious high-density stop fixtures. Isolated, ephemeral DEMO.
 * NOT driver-arrival proof, parent approval, real trip data or a pupil identity.
 */
import {makeAttendantDemo} from './attendant-demo.mjs';

export const USABILITY_SIZES=Object.freeze([5,15,30,50]);
export function makeUsabilityFixture(size){
 if(!Number.isInteger(size)||!USABILITY_SIZES.includes(size))throw Error('INVALID_DEMO_LOAD_SIZE');
 const s=makeAttendantDemo();
 if(s.mode!=='demo'||s.session.mode!=='demo')throw Error('DEMO_ONLY');
 const descents=Math.floor(size/3);
 const absences=Math.floor(size/5);
 const montées=size-descents-absences;
 s.students=Array.from({length:size},(_,i)=>{
  const isDescent=i<descents;
  const isAbsent=i>=size-absences;
  return {
   id:'TEST-'+String(i+1).padStart(3,'0'),
   tripId:s.trip.id,mode:'demo',
   pickupStopId:isDescent?'STOP-01':'STOP-02',
   dropoffStopId:isDescent?'STOP-02':'STOP-03',
   absent:isAbsent,
   absenceReason:isAbsent?'family_notified':null,
   boarded:isDescent,
   alighted:false
  };
 });
 // Explicit synthetic already-started scenario. No real Chauffeur approval.
 s.trip.status='in_progress';
 s.trip.onboardCount=descents;
 s.presence=true;s.driverSecured=true;s.ready=false;
 s.stops[0].reached=true;s.stops[1].reached=true;
 s.activeStopId='STOP-02';s.atStop=true;
 s.events.push({
  id:'DEMO-SCENARIO-'+size,type:'synthetic_load_fixture',
  stopId:'STOP-02',mode:'demo',delivery:'LOCAL_SIMULATION_ONLY'
 });
 s.nextId=1;
 s.usabilityFixture=Object.freeze({size,descents,montées,absences,expectedActions:descents+montées,
  scenario:'ONE_STOP_MIXED_MOVEMENTS',realDriverApproval:false});
 return s;
}
