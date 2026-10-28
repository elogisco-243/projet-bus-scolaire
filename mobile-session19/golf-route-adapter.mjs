/** UI-187: immutable Golf route contract for four demo profiles.
 * Pure data transformation only. Does not alter UI assets, simulate authority,
 * synchronize phones, or accept operational commands.
 */
export const GOLF_ROUTE=Object.freeze({
 id:'GOLF-DEMO-01',busId:'LUB-014',name:'Circuit Golf',mode:'demo',
 stops:Object.freeze([
  Object.freeze({id:'GOLF-STOP-01',name:'Dépôt',order:0}),
  Object.freeze({id:'GOLF-STOP-02',name:'Golf',order:1}),
  Object.freeze({id:'GOLF-STOP-03',name:'Centre',order:2}),
  Object.freeze({id:'GOLF-STOP-04',name:'École Horizon',order:3})
 ]),
 pupils:Object.freeze([
  Object.freeze({id:'A-01',pickupStopId:'GOLF-STOP-01',dropoffStopId:'GOLF-STOP-04'}),
  Object.freeze({id:'A-02',pickupStopId:'GOLF-STOP-02',dropoffStopId:'GOLF-STOP-04'}),
  Object.freeze({id:'A-03',pickupStopId:'GOLF-STOP-02',dropoffStopId:'GOLF-STOP-04'}),
  Object.freeze({id:'A-04',pickupStopId:'GOLF-STOP-03',dropoffStopId:'GOLF-STOP-04'})
 ])
});
const ROLES=Object.freeze(['driver','attendant','parent','supervisor']);
const deny=code=>Object.freeze({ok:false,code});
export function createGolfDemoSnapshot(){
 return {routeId:GOLF_ROUTE.id,busId:GOLF_ROUTE.busId,mode:'demo',
  revision:0,status:'planned',currentStopId:null,
  stops:GOLF_ROUTE.stops.map(stop=>({...stop,reached:false})),
  students:GOLF_ROUTE.pupils.map(p=>({...p,boarded:false,alighted:false,absent:false})),
  incidents:[]};
}
export function validateGolfSnapshot(s){
 if(!s||s.mode!=='demo'||s.routeId!==GOLF_ROUTE.id||s.busId!==GOLF_ROUTE.busId)
  return deny('GOLF_ROUTE_MISMATCH');
 if(!Number.isSafeInteger(s.revision)||s.revision<0)return deny('INVALID_REVISION');
 if(!Array.isArray(s.stops)||s.stops.length!==GOLF_ROUTE.stops.length||
    s.stops.some((p,i)=>p.id!==GOLF_ROUTE.stops[i].id))return deny('STOP_SEQUENCE_MISMATCH');
 if(!Array.isArray(s.students)||s.students.length!==GOLF_ROUTE.pupils.length||
    s.students.some((p,i)=>p.id!==GOLF_ROUTE.pupils[i].id))return deny('STUDENT_ROSTER_MISMATCH');
 if(!Array.isArray(s.incidents))return deny('INVALID_INCIDENTS');
 return Object.freeze({ok:true,code:'OK'});
}
/** role-specific read-only projection; not authentication or authorization. */
export function projectGolfDemo(s,role){
 const valid=validateGolfSnapshot(s);
 if(!valid.ok)return valid;
 if(!ROLES.includes(role))return deny('ROLE_UNKNOWN');
 const reached=s.stops.filter(p=>p.reached===true).length;
 const onboard=s.students.filter(p=>p.boarded===true&&p.alighted!==true).length;
 const next=s.stops.find(p=>p.reached!==true)?.name??'Terminus atteint';
 const shared={ok:true,mode:'demo',routeId:s.routeId,routeName:GOLF_ROUTE.name,
  busId:s.busId,revision:s.revision,status:s.status,
  stopsReached:reached,stopsTotal:s.stops.length,nextStop:next,onboard,
  stopNames:GOLF_ROUTE.stops.map(p=>p.name)};
 if(role==='parent')return Object.freeze({...shared,role,
  students:s.students.map(p=>({id:p.id,state:p.alighted?'descendu':p.boarded?'a bord':p.absent?'absent':'a pointer'}))});
 if(role==='supervisor')return Object.freeze({...shared,role,
  openIncidents:s.incidents.filter(i=>i.status==='open').length,
  studentsAssigned:s.students.length});
 return Object.freeze({...shared,role,stopId:s.currentStopId,
  students:s.students.map(p=>({...p}))});
}
/** Never dispatch a mutation from a role chosen locally in demo. */
export function applyOperationalGolfAction(){return deny('OPERATIONAL_DISPATCH_DISABLED');}
export function verifyRemoteGolfSync(){return deny('TRUSTED_SERVER_SYNC_REQUIRED');}
