/** UI-160 — Pure, role-neutral preflight rules for a future shared trip domain.
 * Demo engine uses them in addition to the attendant's own authorization.
 * This module NEVER authenticates a user, verifies a physical parked bus,
 * sends an alert, signs an event or synchronizes two separate APKs.
 */
export const fail=(code)=>Object.freeze({ok:false,code});
export const permit=()=>Object.freeze({ok:true,code:'OK'});
export const DRIVER_REFERENCE=Object.freeze({
 source:'Chauffeur v1.7 / UI-145 (user-supplied APK)',
 origin:['Dépôt','Golf','Centre','École Horizon'],
 totalDriverArrivalEvents:3,
 referencePupils:['A-01','A-02','A-03','A-04']
});
export function checkArrivedStop({started=false,completed=false,parked=false,atStop=false,activeStopId=null,stops=[]}={}){
 if(!started||completed)return fail('TRIP_NOT_ACTIVE');
 if(!parked||!atStop||!activeStopId)return fail('VEHICLE_NOT_SECURED_AT_STOP');
 const index=stops.findIndex(p=>p.id===activeStopId);
 if(index<0||stops[index].reached!==true)return fail('STOP_NOT_CONFIRMED');
 if(stops.slice(0,index).some(p=>p.reached!==true)||stops.slice(index+1).some(p=>p.reached))return fail('STOP_ORDER_CONFLICT');
 return permit();
}
export function checkStudentAtStop({started=false,completed=false,parked=false,atStop=false,activeStopId=null,stops=[],student=null,action=null}={}){
 const arrival=checkArrivedStop({started,completed,parked,atStop,activeStopId,stops});
 if(!arrival.ok)return arrival;
 if(!student||!['board','alight','mark_absent'].includes(action))return fail('STUDENT_OR_ACTION_UNKNOWN');
 if(student.absent&&action==='board')return fail('REPORTED_ABSENT');
 if(action==='board'&&student.boarded)return fail('DUPLICATE_BOARDING');
 if(action==='mark_absent'&&(student.absent||student.boarded))return fail('ABSENCE_ALREADY_RESOLVED');
 if(action==='alight'&&(!student.boarded||student.alighted))return fail('NOT_ONBOARD');
 const requiredStop=action==='alight'?student.dropoffStopId:student.pickupStopId;
 if(!requiredStop||requiredStop!==activeStopId)return fail('PUPIL_WRONG_STOP');
 return permit();
}
export function checkClosure({started=false,completed=false,parked=false,atStop=false,activeStopId=null,stops=[],students=[],unresolvedAlerts=0,inspectionConfirmed=false}={}){
 if(!started||completed)return fail('TRIP_NOT_ACTIVE');
 if(!stops.length||stops.some(p=>!p.reached)||stops.at(-1).id!==activeStopId)return fail('ROUTE_NOT_COMPLETED');
 const stop=checkArrivedStop({started,completed,parked,atStop,activeStopId,stops});
 if(!stop.ok)return stop;
 if(students.some(p=>p.boarded&&!p.alighted))return fail('CHILDREN_REMAIN');
 if(students.some(p=>!p.absent&&!(p.boarded&&p.alighted)))return fail('STUDENTS_NOT_RECONCILED');
 if(unresolvedAlerts>0)return fail('OPEN_INCIDENTS');
 if(!inspectionConfirmed)return fail('FINAL_INSPECTION_REQUIRED');
 return permit();
}
/** A local browser/API payload cannot prove that two separate human identities signed.
 * Only the future trusted server adapter may implement signature verification,
 * server revision, allocation and anti-replay; always fail closed in this demo. */
export function verifyCrossRoleApproval(){return fail('TRUSTED_SERVER_VERIFICATION_REQUIRED');}
