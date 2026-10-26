/**
 * UI-167 / SYNC-21 — local, in-memory cross-role coordination TEST CONTRACT.
 * No server, no network, no real auth, no physical badge proof.
 * All role identities and authorizations are fictitious and spoofable.
 * MUST NOT be imported as an operational authorizer.
 */
const ACTORS=Object.freeze({'DR-DEMO':'driver','AT-DEMO':'attendant','PA-DEMO':'parent','PB-DEMO':'parent','SU-DEMO':'supervisor'});
const ROLES=Object.freeze({
 ready:['attendant'],start:['driver'],arrive:['driver'],
 board:['driver','attendant'],absent:['driver','attendant'],
 clear_stop:['attendant'],resume:['driver'],finish:['driver'],
 notify_absence:['parent'],request_change:['parent'],cancel_change:['parent'],revalidate_change_demo:['supervisor'],review_change_demo:['supervisor'],reject_change_demo:['supervisor'],
 report_critical:['driver','attendant'],resolve_critical_demo:['supervisor'],
 review_handover_demo:['supervisor'],handover_demo:['driver','attendant']
});
const fail=code=>{throw new Error(code);};
const duplicate=s=>structuredClone(s);
const assertId=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{5,72}$/.test(x);
const index=(s,id)=>s.stops.findIndex(x=>x===id);
const due=s=>{
 if(!s.parked||s.stopIndex<0)return [];
 const stop=s.stops[s.stopIndex];
 return s.students.filter(p=>p.pickupStopId===stop&&!p.boarded&&!p.absent||
   p.dropoffStopId===stop&&p.boarded&&!p.released);
};
const critical=s=>s.alerts.some(x=>x.open===true);
const pupil=(s,id)=>s.students.find(x=>x.id===id)||fail('UNKNOWN_STUDENT');

export function newCoordinationDemo(){
 return {mode:'demo',organizationId:'SCHOOL-DEMO',tripId:'TRIP-DEMO-167',
  status:'planned',revision:0,
  stops:['STOP-01','STOP-02','STOP-03'],stopIndex:-1,parked:false,
  attendantReady:false,stopClearance:false,
  students:[
   {id:'E-01',parentId:'PA-DEMO',pickupStopId:'STOP-01',dropoffStopId:'STOP-03',boarded:false,absent:false,released:false,recipientId:'PA-DEMO'},
   {id:'E-02',parentId:'PB-DEMO',pickupStopId:'STOP-02',dropoffStopId:'STOP-03',boarded:false,absent:false,released:false,recipientId:'PB-DEMO'}],
  requests:[],handovers:[],alerts:[],events:[],keys:{},delivery:'LOCAL_SIMULATION_ONLY'};
}
function authorize(s,cmd){
 if(s.mode!=='demo'||cmd?.mode!=='demo')fail('OPERATIONAL_SERVER_REQUIRED');
 if(cmd.organizationId!==s.organizationId||cmd.tripId!==s.tripId)fail('SCOPE_MISMATCH');
 if(!assertId(cmd.commandId))fail('INVALID_COMMAND_ID');
 if(ACTORS[cmd.actorId]!==cmd.role||!ROLES[cmd.type]?.includes(cmd.role))fail('DEMO_ROLE_DENIED');
 if(!Number.isSafeInteger(cmd.expectedRevision)||cmd.expectedRevision<0)fail('INVALID_REVISION');
}
function atStop(s){if(s.status!=='in_progress'||!s.parked||s.stopIndex<0)fail('NO_PARKED_ACTIVE_STOP');}
function expectedStop(s,p,action){
 atStop(s);
 if(p[action==='board'||action==='absent'?'pickupStopId':'dropoffStopId']!==s.stops[s.stopIndex])fail('WRONG_STOP');
}
function accept(s,cmd){
 const prior=s.keys[cmd.commandId];
 // A retry with the same content is idempotent even after revision changed.
 const fingerprint=JSON.stringify([cmd.mode,cmd.organizationId,cmd.tripId,cmd.role,cmd.actorId,cmd.type,cmd.payload??null]);
 if(prior){
  if(prior!==fingerprint)fail('IDEMPOTENCY_CONFLICT');
  return {accepted:false,alreadyApplied:true,state:duplicate(s)};
 }
 if(cmd.expectedRevision!==s.revision)fail('STALE_REVISION');
 s.keys[cmd.commandId]=fingerprint;
 s.revision+=1;
 s.events.push({seq:s.revision,type:cmd.type,actorId:cmd.actorId,
  role:cmd.role,mode:'demo',delivery:'LOCAL_SIMULATION_ONLY'});
 return {accepted:true,alreadyApplied:false,state:s};
}
export function applyCoordinationDemo(original,command){
 const s=duplicate(original);
 authorize(s,command);
 const cmd=command,p=cmd.payload??{},role=cmd.role,type=cmd.type;
 if(s.keys[cmd.commandId])return accept(s,cmd);
 if(s.revision!==cmd.expectedRevision)fail('STALE_REVISION');
 switch(type){
 case 'ready':
  if(s.status!=='planned')fail('TRIP_ALREADY_STARTED');
  s.attendantReady=true;break;
 case 'start':
  if(s.status!=='planned'||!s.attendantReady)fail('CROSS_ROLE_READY_REQUIRED');
  s.status='in_progress';break;
 case 'arrive':
  if(s.status!=='in_progress'||s.parked||s.stopIndex>=s.stops.length-1)fail('ARRIVAL_NOT_ALLOWED');
  if(p.stopId!==s.stops[s.stopIndex+1])fail('STOP_ORDER_CONFLICT');
  s.stopIndex+=1;s.parked=true;s.stopClearance=false;break;
 case 'board':{
  const child=pupil(s,p.studentId);expectedStop(s,child,'board');
  if(child.boarded||child.absent)fail('INVALID_BOARDING');
  child.boarded=true;break;
 }
 case 'absent':{
  const child=pupil(s,p.studentId);expectedStop(s,child,'absent');
  if(child.absent||child.boarded||!['not_present','family_notified'].includes(p.reason))fail('INVALID_ABSENCE');
  child.absent=true;break;
 }
 case 'clear_stop':
  atStop(s);
  if(due(s).length)fail('POINTAGE_PENDING');
  if(critical(s))fail('CRITICAL_INCIDENT_OPEN');
  s.stopClearance=true;break;
 case 'resume':
  atStop(s);
  if(s.stopIndex===s.stops.length-1)fail('AT_TERMINUS');
  if(!s.stopClearance||due(s).length||critical(s))fail('SAFETY_CLEARANCE_REQUIRED');
  s.parked=false;s.stopClearance=false;break;
 case 'finish':
  atStop(s);
  if(s.stopIndex!==s.stops.length-1||!s.stopClearance||due(s).length||
    s.students.some(x=>x.boarded&&!x.released)||critical(s))fail('CLOSURE_NOT_SAFE');
  // No real physical bus inspection can be established by this local demo.
  if(p.demoInspectionAcknowledged!==true)fail('DEMO_INSPECTION_REQUIRED');
  s.status='completed';break;
 case 'notify_absence':{
  if(!['planned','in_progress'].includes(s.status))fail('TRIP_NOT_ACTIVE');
  const child=pupil(s,p.studentId);
  if(child.parentId!==cmd.actorId)fail('PARENT_NOT_AUTHORIZED');
  if(child.boarded||child.released||child.absent)fail('ABSENCE_NOT_ALLOWED');
  if(index(s,child.pickupStopId)<=s.stopIndex)fail('PICKUP_ALREADY_REACHED');
  if(p.reason!=='family_notified')fail('ABSENCE_REASON_REQUIRED');
  child.absent=true;break;
 }
 case 'request_change':{
  if(s.status!=='in_progress')fail('TRIP_NOT_ACTIVE');
  const child=pupil(s,p.studentId);
  if(child.parentId!==cmd.actorId)fail('PARENT_NOT_AUTHORIZED');
  if(child.released||child.absent)fail('CHILD_NOT_ELIGIBLE');
  const i=index(s,p.toStopId),old=index(s,child.dropoffStopId);
  if(i<0||i<=s.stopIndex||old<=s.stopIndex||i===old)fail('STOP_UNAVAILABLE');
  if(s.requests.some(x=>x.studentId===child.id&&x.status==='pending'))fail('REQUEST_ALREADY_PENDING');
  if(p.recipientId!==child.recipientId)fail('RECIPIENT_NOT_AUTHORIZED');
  s.requests.push({id:'REQ-DEMO-'+(s.revision+1),studentId:child.id,parentId:cmd.actorId,
   fromStopId:child.dropoffStopId,toStopId:p.toStopId,recipientId:p.recipientId,
   status:'pending',proposedRevision:s.revision+1});break;
 }
 case 'cancel_change':{
  const req=s.requests.find(x=>x.id===p.requestId&&x.status==='pending');
  if(!req)fail('REQUEST_NOT_PENDING');
  if(req.parentId!==cmd.actorId)fail('PARENT_NOT_AUTHORIZED');
  req.status='cancelled';break;
 }
 case 'revalidate_change_demo':{
  if(s.status!=='in_progress')fail('TRIP_NOT_ACTIVE');
  const req=s.requests.find(x=>x.id===p.requestId&&x.status==='pending');
  if(!req)fail('REQUEST_NOT_PENDING');
  const child=pupil(s,req.studentId);
  if(index(s,req.toStopId)<=s.stopIndex||index(s,req.fromStopId)<=s.stopIndex||
    child.dropoffStopId!==req.fromStopId||child.released)fail('ORIGINAL_OR_NEW_STOP_PASSED');
  // Fresh independent supervisor review in a new transaction, never automatic approval.
  req.proposedRevision=s.revision+1;break;
 }
 case 'review_change_demo':{
  if(s.status!=='in_progress')fail('TRIP_NOT_ACTIVE');
  const req=s.requests.find(x=>x.id===p.requestId&&x.status==='pending');
  if(!req)fail('REQUEST_NOT_PENDING');
  const child=pupil(s,req.studentId);
  if(index(s,req.toStopId)<=s.stopIndex||index(s,req.fromStopId)<=s.stopIndex||
    child.dropoffStopId!==req.fromStopId)fail('ORIGINAL_OR_NEW_STOP_PASSED');
  if(req.proposedRevision!==s.revision)fail('REQUEST_NEEDS_FRESH_REVIEW');
  // Labelled simulation only. NO real authorization can be created here.
  if(p.demoPolicyApproved!==true)fail('DEMO_POLICY_NOT_APPROVED');
  req.status='approved_demo';child.dropoffStopId=req.toStopId;break;
 }
 case 'reject_change_demo':{
  if(s.status!=='in_progress')fail('TRIP_NOT_ACTIVE');
  const req=s.requests.find(x=>x.id===p.requestId&&x.status==='pending');
  if(!req)fail('REQUEST_NOT_PENDING');
  if(!['policy_refused','authorization_expired','route_not_safe'].includes(p.reason))fail('REJECTION_REASON_REQUIRED');
  req.status='rejected_demo';req.reason=p.reason;break;
 }
 case 'report_critical':
  if(s.status!=='in_progress'||!['medical','missing_child','accident'].includes(p.kind))fail('INVALID_INCIDENT');
  s.alerts.push({id:'INC-DEMO-'+(s.revision+1),kind:p.kind,open:true});s.stopClearance=false;break;
 case 'resolve_critical_demo':{
  atStop(s);
  const alert=s.alerts.find(x=>x.id===p.incidentId&&x.open);
  if(!alert||p.demoResolutionConfirmed!==true)fail('INCIDENT_NOT_RESOLVED');
  alert.open=false;break;
 }
 case 'review_handover_demo':{
  atStop(s);
  const child=pupil(s,p.studentId);expectedStop(s,child,'alight');
  if(!child.boarded||child.released)fail('NOT_ONBOARD');
  if(p.recipientId!==child.recipientId)fail('RECIPIENT_NOT_AUTHORIZED');
  // Deliberately synthetic: this does not verify a real badge or person.
  if(p.demoRecipientAndPersonChecked!==true)fail('SYNTHETIC_REVIEW_REQUIRED');
  s.handovers.push({studentId:child.id,recipientId:p.recipientId,stopId:s.stops[s.stopIndex],
   status:'reviewed_demo',reviewRevision:s.revision+1});break;
 }
 case 'handover_demo':{
  atStop(s);
  const child=pupil(s,p.studentId);expectedStop(s,child,'alight');
  if(!child.boarded||child.released)fail('NOT_ONBOARD');
  const review=s.handovers.findLast(x=>x.studentId===child.id&&x.status==='reviewed_demo'&&
   x.recipientId===p.recipientId&&x.stopId===s.stops[s.stopIndex]);
  if(!review||p.demoPhysicalHandoverConfirmed!==true)fail('SYNTHETIC_HANDOVER_REVIEW_REQUIRED');
  child.released=true;review.status='handed_over_demo';s.stopClearance=false;break;
 }
 default:fail('ACTION_DENIED');
 }
 return accept(s,cmd);
}
export function viewCoordinationDemo(s,actorId){
 if(s?.mode!=='demo'||!ACTORS[actorId])fail('DEMO_ONLY');
 const role=ACTORS[actorId];
 const data={mode:'demo',role,tripId:s.tripId,status:s.status,revision:s.revision,
  stopId:s.stops[s.stopIndex]??null,parked:s.parked,
  attendantReady:s.attendantReady,
  pendingAtStop:due(s).length,criticalAlerts:s.alerts.filter(x=>x.open).length,
  stopClearance:s.stopClearance};
 if(role==='parent')return {...data,children:s.students.filter(x=>x.parentId===actorId).map(x=>({
  studentId:x.id,pickupStopId:x.pickupStopId,dropoffStopId:x.dropoffStopId,
  pickupAlreadyPassed:index(s,x.pickupStopId)<=s.stopIndex,
  boarded:x.boarded,absent:x.absent,released:x.released})),
  requests:s.requests.filter(x=>x.parentId===actorId).map(x=>({...x}))};
 return {...data,onboard:s.students.filter(x=>x.boarded&&!x.released).map(x=>x.id),
  waiting:due(s).map(x=>x.id),
  ...(role==='supervisor'?{
    requests:s.requests.map(x=>({...x})),
    alerts:s.alerts.map(x=>({...x})),
    handovers:s.handovers.map(x=>({...x})),
    students:s.students.map(x=>({studentId:x.id,dropoffStopId:x.dropoffStopId,boarded:x.boarded,absent:x.absent,released:x.released,
      recipientId:x.recipientId})),
    stops:s.stops.slice()
  }:{}),
  ...(role==='driver'||role==='attendant'?{
    students:s.students.map(x=>({studentId:x.id,pickupStopId:x.pickupStopId,dropoffStopId:x.dropoffStopId,
      boarded:x.boarded,absent:x.absent,released:x.released,recipientId:x.recipientId})),
    alerts:s.alerts.map(x=>({...x})),
    handovers:s.handovers.map(x=>({...x})),
    stops:s.stops.slice()
  }:{})};
}
// This is the security boundary: no self-declared mobile claims authorize a real mutation.
export function authorizeOperationalCommand(){
 return Object.freeze({ok:false,code:'TRUSTED_AUTHENTICATED_SERVER_REQUIRED'});
}
