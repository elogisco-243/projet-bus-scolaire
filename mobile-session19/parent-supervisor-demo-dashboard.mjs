/** UI-192: read-only demo presenters for Parent / Superviseur.
 * No modification to mature Driver / Attendant UIs. Never authoritative.
 */
import {fourRoleDemoView} from './four-role-demo-workflow.mjs';
import {nextSimpleAction} from './four-role-simple-actions.mjs';

const fail=code=>Object.freeze({ok:false,code});
const freeze=x=>Object.freeze(x);
export function parentDemoDashboard(snapshot,{pupilIds=[]}={}){
 if(!Array.isArray(pupilIds))return fail('PUPIL_SCOPE_REQUIRED');
 const ids=[...new Set(pupilIds.filter(x=>typeof x==='string'))];
 const projection=fourRoleDemoView(snapshot,'parent',{parentStudentIds:ids});
 if(!projection.ok)return projection;
 const hint=nextSimpleAction(snapshot,'parent',{parentStudentIds:ids});
 if(!hint.ok)return hint;
 const notices=(snapshot.notifications||[]).filter(n=>ids.includes(n.studentId)).map(n=>freeze({
  id:n.id,studentId:n.studentId,type:n.action,read:n.status!=='unread'
 }));
 return freeze({ok:true,mode:'demo',title:'Suivi de mon enfant',
  busId:projection.busId,routeName:projection.routeName,routeStops:projection.stopNames,
  status:projection.status,nextStop:projection.nextStop,
  stopsReached:projection.stopsReached,stopsTotal:projection.stopsTotal,
  pupils:projection.students.map(p=>freeze({id:p.id,state:p.state})),
  notifications:notices,primary:hint.primary,
  locationAvailable:false,remoteSync:false,canChangeTrip:false
 });
}
export function supervisorDemoDashboard(snapshot){
 const projection=fourRoleDemoView(snapshot,'supervisor');
 if(!projection.ok)return projection;
 const hint=nextSimpleAction(snapshot,'supervisor');
 if(!hint.ok)return hint;
 return freeze({ok:true,mode:'demo',title:'Supervision de la tournée',
  busId:projection.busId,routeName:projection.routeName,routeStops:projection.stopNames,
  status:projection.status,nextStop:projection.nextStop,
  stopsReached:projection.stopsReached,stopsTotal:projection.stopsTotal,
  onboard:projection.onboard,assigned:projection.studentsAssigned,
  incidents:projection.incidents.map(i=>freeze({id:i.id,kind:i.kind,status:i.status})),
  reviewed:projection.reviewed,primary:hint.primary,
  remoteSync:false,canAuthorizeOperational:false
 });
}
export function parentOrSupervisorOperationalAccess(){return fail('OPERATIONAL_DISPATCH_DISABLED');}
