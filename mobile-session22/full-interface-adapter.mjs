/**
 * UI-177 integration boundary for complete Android-facing role interfaces.
 * No direct network effects, no change to UI-170, no self-asserted authorization.
 * Current output is planning-only: all production dispatches disabled.
 */
const ATTENDANT=Object.freeze({
 demo_prepare_departure:{kind:'trip.ready',needsServerApproval:true},
 start_demo_trip:{kind:'trip.start',owner:'driver'},
 simulate_arrival:{kind:'trip.arrive',owner:'driver'},
 board:{kind:'student.board'},
 mark_absent:{kind:'student.absent'},
 alight:{kind:'handover.record',needsIndependentReview:true},
 demo_confirm_empty_and_finish:{kind:'trip.finish',owner:'driver',needsServerApproval:true},
 simulate_driver_resume:{kind:'trip.resume',owner:'driver'},
 incident:{kind:'incident.report'},
 resolve_incident:{kind:'incident.review',owner:'supervisor'}
});
const DRIVER=Object.freeze({
 ready:'trip.ready',start:'trip.start',arrive:'trip.arrive',
 resume:'trip.resume',finish:'trip.finish',report_critical:'incident.report'
});
export function planCompleteInterfaceAction({profile,action,mode='demo',tripId,studentId}={}){
 if(!['chauffeur','accompagnateur'].includes(profile))return Object.freeze({ok:false,code:'UNSUPPORTED_FULL_INTERFACE'});
 if(mode!=='demo')return Object.freeze({ok:false,code:'OPERATIONAL_DISPATCH_DISABLED'});
 const source=profile==='accompagnateur'?ATTENDANT[action]:null;
 const kind=profile==='chauffeur'?DRIVER[action]:source?.kind;
 if(!kind)return Object.freeze({ok:false,code:'ACTION_NOT_MAPPED'});
 const owner=source?.owner;
 if(owner&&owner!==(profile==='chauffeur'?'driver':'attendant'))
   return Object.freeze({ok:false,code:'CROSS_ROLE_APPROVAL_REQUIRED',action:kind});
 if(kind.startsWith('student.')&&(!studentId||typeof studentId!=='string'))
   return Object.freeze({ok:false,code:'STUDENT_CONTEXT_REQUIRED'});
 // UI-177 never issues operational commands; a server verified context must be added later.
 return Object.freeze({ok:true,code:'DEMO_ACTION_CLASSIFIED',role:profile,action:kind,
  requiresIndependentReview:!!source?.needsIndependentReview,
  requiresServerApproval:!!source?.needsServerApproval,
  tripId:typeof tripId==='string'?tripId:null,
  dispatchEnabled:false});
}
export function operationalDispatch(){return Object.freeze({ok:false,code:'OPERATIONAL_DISPATCH_DISABLED'});}
