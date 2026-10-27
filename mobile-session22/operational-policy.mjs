/**
 * UI-172: fail-closed authorization POLICY CONTRACT, not an authentication service.
 * This module NEVER verifies passwords, token signatures, badges or real identities.
 * The operational gateway MUST supply a trusted, server-verified principal.
 * No demo session or client-supplied role may be promoted to operational status.
 */
const ROLES=Object.freeze({
 driver:new Set(['trip.read','trip.start','trip.arrive','trip.resume','trip.finish','incident.report']),
 attendant:new Set(['trip.read','trip.ready','student.board','student.absent','stop.clear','handover.record','incident.report']),
 parent:new Set(['child.read','child.absence','change.request','change.cancel']),
 supervisor:new Set(['trip.read','incident.review','change.review','handover.review'])
});
const DENY=code=>Object.freeze({ok:false,code});
const allow=()=>Object.freeze({ok:true,code:'AUTHORIZED'});
const nonempty=s=>typeof s==='string'&&s.length>0&&s.length<=128;
export function authorizeOperationalAction({principal,action,resource,verifiedContext}={}){
  // Caller identity cannot be supplied from a demo browser or untrusted payload.
  if(verifiedContext?.serverVerified!==true || verifiedContext?.authenticationStrength!=='verified')
    return DENY('TRUSTED_AUTHENTICATION_REQUIRED');
  if(!principal||principal.source!=='trusted_gateway'||principal.active!==true||
    !nonempty(principal.id)||!nonempty(principal.organizationId)||
    !Object.hasOwn(ROLES,principal.role))
    return DENY('INVALID_TRUSTED_PRINCIPAL');
  if(!nonempty(action)||!nonempty(resource?.organizationId)||
    resource.organizationId!==principal.organizationId)
    return DENY('SCOPE_DENIED');
  if(!ROLES[principal.role].has(action))return DENY('ROLE_DENIED');
  if(principal.role==='parent'){
    if(!nonempty(resource.studentId)||!Array.isArray(principal.authorizedStudentIds)||
       !principal.authorizedStudentIds.includes(resource.studentId))
      return DENY('PARENT_CHILD_DENIED');
  } else if(principal.role!=='supervisor'){
    if(!nonempty(resource.tripId)||!Array.isArray(principal.assignedTripIds)||
       !principal.assignedTripIds.includes(resource.tripId))
      return DENY('TRIP_ASSIGNMENT_DENIED');
  }
  if(['change.review','handover.review','incident.review'].includes(action)&&
     (!nonempty(resource.requestedBy)||resource.requestedBy===principal.id))
    return DENY('INDEPENDENT_REVIEW_REQUIRED');
  return allow();
}
export function assertOperationalGatewayReady({identityProviderVerified=false,tlsEnforced=false,
  persistentAudit=false,durableState=false,offlineConflictStrategyVerified=false}={}){
  const missing=Object.entries({identityProviderVerified,tlsEnforced,persistentAudit,
    durableState,offlineConflictStrategyVerified}).filter(([,value])=>value!==true).map(([key])=>key);
  return missing.length?Object.freeze({ok:false,code:'OPERATIONAL_GATES_INCOMPLETE',missing}):
    Object.freeze({ok:true,code:'PREREQUISITES_DECLARED_NOT_INDEPENDENTLY_VERIFIED'});
}
