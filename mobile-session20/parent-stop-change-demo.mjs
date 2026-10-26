/**
 * A2S Scola UI-162 — PARENT REQUEST → VERIFIED POLICY → ATTENDANT HANDOVER.
 * Standalone DEMO-only reference, NOT connected to Chauffeur or any real parent.
 * No local flag/badge can authorize an operational release of a child.
 */
const error=code=>{throw new Error(code);};
const copy=s=>structuredClone(s);
const event=(s,type,changeId=null)=>{
 s.events.push({id:'DEMO-H-'+(s.nextId++),type,changeId,delivery:'LOCAL_SIMULATION_ONLY'});
 return s;
};
const studentOf=(s,id)=>s.students.find(x=>x.id===id);
const stopOf=(s,id)=>s.stops.find(x=>x.id===id);
const pending=s=>s.requests.filter(r=>r.status==='pending');
const isDownstream=(s,stopId)=>{
 const stop=stopOf(s,stopId);
 const activeIndex=s.stops.findLastIndex(x=>x.passed);
 const destIndex=s.stops.findIndex(x=>x.id===stopId);
 return !!stop&&!stop.passed&&destIndex>activeIndex;
};
const authority=(s,actorId,studentId)=>{
 const actor=s.people.find(p=>p.id===actorId);
 if(!actor||actor.role!=='parent'||actor.active!==true||actor.canRequest!==true)return false;
 return actor.children.includes(studentId);
};
const recipientAllowed=(s,pupil,recipientId)=>{
 const person=s.people.find(p=>p.id===recipientId);
 return !!person&&person.active===true&&person.canReceive===true&&
   pupil.allowedRecipients.includes(recipientId)&&
   !pupil.restrictedRecipients.includes(recipientId);
};
const guard=s=>{
 if(s?.mode!=='demo'||s.trip?.mode!=='demo')error('DEMO_ONLY');
 if(s.trip.status!=='planned'&&s.trip.status!=='in_progress')error('TRIP_NOT_ACTIVE');
};
export function newParentChangeDemo(){
 return {
  mode:'demo',trip:{id:'TRIP-DEMO',mode:'demo',status:'in_progress',revision:1},
  stops:[
   {id:'STOP-01',name:'Dépôt',passed:true},
   {id:'STOP-02',name:'Golf',passed:false},
   {id:'STOP-03',name:'Centre',passed:false},
   {id:'STOP-04',name:'École Horizon',passed:false}
  ],
  people:[
   {id:'P-01',role:'parent',active:true,canRequest:true,canReceive:true,children:['E-014']},
   {id:'G-01',role:'guardian',active:true,canRequest:false,canReceive:true,children:[]},
   {id:'X-01',role:'guardian',active:false,canRequest:false,canReceive:false,children:[]}
  ],
  students:[{
   id:'E-014',tripId:'TRIP-DEMO',boarded:true,alighted:false,
   dropoffStopId:'STOP-02',allowedRecipients:['P-01','G-01'],
   restrictedRecipients:[],releasedTo:null
  }],
  requests:[],events:[],nextId:1
 };
}
export function parentRequestStopChange(original,{parentId,studentId,newStopId,recipientId,requestKey}={}){
 const s=copy(original);guard(s);
 if(typeof requestKey!=='string'||!/^[-\w]{5,60}$/.test(requestKey))error('INVALID_REQUEST_KEY');
 const already=s.requests.find(r=>r.requestKey===requestKey);
 if(already){
  if(already.parentId===parentId&&already.studentId===studentId&&
     already.toStopId===newStopId&&already.recipientId===recipientId)return s;
  error('IDEMPOTENCY_KEY_CONFLICT');
 }
 if(!authority(s,parentId,studentId))error('PARENT_NOT_AUTHORIZED');
 const child=studentOf(s,studentId);
 if(!child||child.tripId!==s.trip.id||child.alighted)error('CHILD_NOT_ELIGIBLE');
 if(!recipientAllowed(s,child,recipientId))error('RECIPIENT_NOT_AUTHORIZED');
 if(child.dropoffStopId===newStopId)error('SAME_DROPOFF');
 if(!isDownstream(s,newStopId))error('STOP_UNAVAILABLE');
 // No unattended changes after the original stop is already passed.
 if(!isDownstream(s,child.dropoffStopId))error('ORIGINAL_STOP_ALREADY_PASSED');
 if(pending(s).some(r=>r.studentId===studentId))error('REQUEST_ALREADY_PENDING');
 s.requests.push({
  id:'DEMO-REQ-'+s.nextId++,requestKey,parentId,studentId,recipientId,
  fromStopId:child.dropoffStopId,toStopId:newStopId,
  status:'pending',proposedAtRevision:s.trip.revision,decision:'awaiting_trusted_verification',
  delivery:'LOCAL_SIMULATION_ONLY'
 });
 return event(s,'parent_requested_different_stop',s.requests.at(-1).id);
}
/** Only a separate synthetic supervisor may approve locally.
 * Operational approvals MUST instead be issued by trusted, authenticated server.
 */
export function simulateAuthorizedReview(original,{requestId,reviewer='DEMO-SUPERVISOR',policyEligible=true}={}){
 const s=copy(original);guard(s);
 if(reviewer!=='DEMO-SUPERVISOR')error('SUPERVISOR_REQUIRED');
 const request=s.requests.find(r=>r.id===requestId);
 if(!request||request.status!=='pending')error('NO_PENDING_REQUEST');
 const child=studentOf(s,request.studentId);
 if(!policyEligible)error('POLICY_NOT_APPROVED');
 if(!authority(s,request.parentId,request.studentId)||!recipientAllowed(s,child,request.recipientId))
  error('AUTHORIZATION_CHANGED');
 if(child.alighted||child.dropoffStopId!==request.fromStopId)error('CHILD_OR_ROUTE_CHANGED');
 if(!isDownstream(s,request.toStopId)||!isDownstream(s,request.fromStopId))error('STOP_ALREADY_PASSED');
 if(request.proposedAtRevision!==s.trip.revision)error('STALE_TRIP_REVISION');
 child.dropoffStopId=request.toStopId;
 request.status='approved_demo';
 request.decision='synthetic_policy_approval_not_real';
 request.approvedAtRevision=++s.trip.revision;
 return event(s,'synthetic_stop_change_approved',request.id);
}
export function cancelPendingRequest(original,{parentId,requestId}={}){
 const s=copy(original);guard(s);
 const r=s.requests.find(x=>x.id===requestId);
 if(!r||r.status!=='pending')error('CANNOT_CANCEL_REQUEST');
 if(!authority(s,parentId,r.studentId)||r.parentId!==parentId)error('PARENT_NOT_AUTHORIZED');
 r.status='cancelled';return event(s,'parent_request_cancelled',r.id);
}
export function viewAttendantDropoffs(s,stopId){
 // A pending parent request does not change the roster or release authorization.
 return s.students.filter(p=>p.boarded&&!p.alighted&&p.dropoffStopId===stopId).map(p=>({
  studentId:p.id,stopId,
  approvedChangeId:s.requests.find(r=>r.studentId===p.id&&r.status==='approved_demo')?.id||null,
  due:true
 }));
}
export function viewParentRequest(s,requestId,parentId){
 const r=s.requests.find(x=>x.id===requestId);
 if(!r||!authority(s,parentId,r.studentId)||r.parentId!==parentId)error('PARENT_NOT_AUTHORIZED');
 return structuredClone(r);
}
/** Mirrors handover controls, no untrusted badge-only release.
 * This is purely synthetic. Real OTP/badge verification and role proof are missing.
 */
export function simulateGuardedHandover(original,{studentId,stopId,recipientId,badgeVerified=false,
  physicallyIdentified=false,physicalHandoverConfirmed=false,busParked=false,actor='DEMO-ATTENDANT'}={}){
 const s=copy(original);guard(s);
 if(actor!=='DEMO-ATTENDANT')error('ATTENDANT_REQUIRED');
 const child=studentOf(s,studentId);
 if(!child||child.alighted||!child.boarded)error('NOT_ONBOARD');
 if(!busParked||!stopOf(s,stopId)?.passed||child.dropoffStopId!==stopId)error('STOP_NOT_CONFIRMED');
 if(!recipientAllowed(s,child,recipientId))error('RECIPIENT_NOT_AUTHORIZED');
 if(!badgeVerified||!physicallyIdentified||!physicalHandoverConfirmed)error('HANDOVER_NOT_VERIFIED');
 // If the stop was changed, the approved request must match this recipient.
 const revised=s.requests.filter(r=>r.studentId===studentId&&r.status==='approved_demo').at(-1);
 if(revised&&(revised.toStopId!==stopId||revised.recipientId!==recipientId))error('RECIPIENT_OR_STOP_MISMATCH');
 child.alighted=true;child.releasedTo=recipientId;
 return event(s,'synthetic_guardian_handover_confirmed',revised?.id||null);
}
export function verifyOperationalStopChange(){
 return Object.freeze({ok:false,code:'AUTHENTICATED_SERVER_APPROVAL_REQUIRED'});
}
