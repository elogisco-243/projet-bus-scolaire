/** SYNC-18: policy gate for attendant actions. Not a substitute for server authorization. */
const ATTENDANT='attendant';
const ACTIONS=Object.freeze(['view_trip','confirm_presence','board','alight','report_incident','confirm_empty']);
const MUTATIONS=new Set(['confirm_presence','board','alight','report_incident','confirm_empty']);
export function authorizeAttendant({session,trip,action,student=null,eventMode=null}={}){
 const deny=(code)=>Object.freeze({allowed:false,code});
 if(!session||session.ok!==true||session.role!==ATTENDANT)return deny('ROLE_DENIED');
 if(!['demo','operational'].includes(session.mode))return deny('MODE_DENIED');
 if(session.mode==='operational'&&(session.serverVerified!==true||!session.subject||!session.organizationId))return deny('OPERATIONAL_UNVERIFIED');
 if(!trip||trip.mode!==session.mode)return deny('CROSS_ENVIRONMENT');
 if(session.mode==='operational'&&trip.organizationId!==session.organizationId)return deny('OTHER_ORGANIZATION');
 if(!session.attendantId||trip.attendantId!==session.attendantId)return deny('NOT_ASSIGNED');
 if(!ACTIONS.includes(action))return deny('ACTION_DENIED');
 if(eventMode!==null&&eventMode!==session.mode)return deny('CROSS_ENVIRONMENT');
 if(action==='view_trip')return Object.freeze({allowed:true,code:'OK'});
 if(trip.status!=='in_progress'&&(action!=='confirm_presence'||trip.status!=='planned'))return deny('TRIP_NOT_ACTIVE');
 if(action==='board'||action==='alight'){
  if(!student||student.tripId!==trip.id)return deny('STUDENT_NOT_ON_TRIP');
  if(student.mode!==session.mode)return deny('CROSS_ENVIRONMENT');
  if(session.mode==='operational'&&student.organizationId!==session.organizationId)return deny('OTHER_ORGANIZATION');
  if(action==='board'&&student.absent===true)return deny('REPORTED_ABSENT');
  if(action==='board'&&student.boarded===true)return deny('DUPLICATE_BOARDING');
  if(action==='alight'&&student.boarded!==true)return deny('NOT_BOARDED');
  if(action==='alight'&&student.alighted===true)return deny('DUPLICATE_ALIGHTING');
 }
 if(action==='confirm_empty'&&trip.onboardCount!==0)return deny('CHILDREN_REMAIN');
 return Object.freeze({allowed:true,code:'OK'});
}
export function attendantCanOperateVehicle(){return false;}
