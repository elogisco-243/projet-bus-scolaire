/** UI-190 — Actions simples et contextuelles pour quatre profils (DEMO).
 * Pure presentation guidance only; does not dispatch actions or override safety.
 * Original Chauffeur and Accompagnateur interfaces remain unchanged.
 */
import {validateGolfSnapshot} from './golf-route-adapter.mjs';
const result=(action,label,reason='',requiresConfirmation=false)=>Object.freeze({action,label,reason,requiresConfirmation});
export function nextSimpleAction(state,role,{parentStudentIds=[]}={}){
 const valid=validateGolfSnapshot(state);
 if(!valid.ok)return Object.freeze({ok:false,code:valid.code});
 if(state.version!==1||!Array.isArray(state.events)||!Array.isArray(state.notifications))
  return Object.freeze({ok:false,code:'WORKFLOW_CONTEXT_REQUIRED'});
 if(!['driver','attendant','parent','supervisor'].includes(role))
  return Object.freeze({ok:false,code:'ROLE_UNKNOWN'});
 const atStop=state.atStop===true&&state.secured===true;
 const open=state.incidents.filter(i=>i.status==='open');
 const next=state.stops.find(s=>!s.reached);
 const pending=state.students.filter(p=>
  (p.pickupStopId===state.currentStopId&&!p.boarded&&!p.absent)||
  (p.dropoffStopId===state.currentStopId&&p.boarded&&!p.alighted));
 let primary;
 if(role==='driver'){
  if(state.status==='completed')primary=result('view_summary','Voir le bilan');
  else if(open.length)primary=result('view_alerts','Consulter les alertes','Incident à traiter avant progression');
  else if(!state.secured)primary=result('secure_vehicle','Confirmer l’immobilisation','Vérification de sécurité obligatoire',true);
  else if(state.status==='planned')primary=(!state.attendantPresent||!state.attendantReady)
    ?result('view_team','Voir la préparation de l’équipe','Attendre la confirmation de l’accompagnateur')
    :result('begin','Démarrer la course','Départ après vérifications',true);
  else if(!state.atStop)primary=result('arrive','Déclarer l’arrivée','Confirmer uniquement à l’arrêt',true);
  else if(next)primary=pending.length
    ?result('view_pointage','Voir les pointages','Des élèves restent à traiter')
    :result('resume','Passer au prochain arrêt','Après contrôle des élèves',true);
  else primary=state.inspectionConfirmed
    ?result('close-trip','Clôturer la course','Vérification finale achevée',true)
    :result('view_team','Attendre le contrôle du bus vide','Confirmation accompagnateur requise');
 }else if(role==='attendant'){
  if(state.status==='completed')primary=result('view_summary','Voir le bilan');
  else if(open.length)primary=result('view_alerts','Consulter les alertes','Incident ouvert');
  else if(state.status==='planned')primary=!state.attendantPresent
    ?result('check_in','Confirmer ma présence')
    :!state.secured
    ?result('view_team','Attendre le véhicule sécurisé')
    :!state.attendantReady
    ?result('ready','Confirmer prêt au départ')
    :result('view_trip','Attendre le départ');
  else if(!atStop)primary=result('view_trip','Suivre le prochain arrêt');
  else if(pending.length)primary=result('go_students','Pointer les élèves',pending.length+' élève(s) à traiter');
  else if(!next&&!state.inspectionConfirmed)primary=result('confirm_empty','Confirmer le bus vide','Contrôle physique obligatoire',true);
  else primary=result('view_trip','Voir la tournée');
 }else if(role==='parent'){
  const assigned=new Set(parentStudentIds);
  const unread=state.notifications.filter(n=>assigned.has(n.studentId)&&n.status==='unread');
  primary=unread.length?result('view_notifications','Voir les notifications',unread.length+' nouvelle(s)')
    :result('view_child','Suivre mon enfant');
 }else{
  if(open.length)primary=result('view_alerts','Traiter les alertes',open.length+' incident(s) ouvert(s)');
  else if(state.status==='completed'&&!state.tripReviewed)primary=result('review_trip','Vérifier le bilan');
  else primary=result('view_overview','Voir les tournées');
 }
 return Object.freeze({ok:true,role,primary,secondary:Object.freeze([
  result('view_trip','Ma tournée'),result('view_alerts','Alertes'),
  result('view_team','Équipe'),result('view_more','Plus')
 ]),operationalEnabled:false});
}
