import {makeAttendantDemo,runAttendantDemo,attendantSummary,attendantClosingChecklist,INCIDENTS,CRITICAL_INCIDENTS} from './attendant-demo.mjs';
let state=makeAttendantDemo(),tab='tour',view='dashboard',message='';
// UI-156: visual hints remain local to this DEMO; no timer, telemetry or real alert.
let pointagePulseSeenAt=null, stopPulseWaitingFor=null;
const root=document.querySelector('#app');
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const iconPaths={
 bus:'<rect x="4" y="3" width="16" height="15" rx="3"/><path d="M4 10h16M8 18v3m8-3v3M7 6h2m6 0h2"/>',
 alert:'<path d="M10.3 3.9 2.1 18.2A1.8 1.8 0 0 0 3.7 21h16.6a1.8 1.8 0 0 0 1.6-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 4h.01"/>',
 check:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="m8 12 3 3 5-6"/>',
 team:'<path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m16-8a4 4 0 0 1 4 4v4M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8-8a4 4 0 0 1 0 8"/>',
 pin:'<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
 route:'<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h7a3 3 0 0 0 0-6H9a3 3 0 1 1 0-6h7"/>',
 traffic:'<path d="m12 3-8 18h16L12 3ZM8.2 13h7.6M10 9h4m-3.4 8h2.8"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 wrench:'<path d="M14.2 6.3a5 5 0 0 0-6.5 6.5L3 18.1 5.9 21l5.8-4.7a5 5 0 0 0 6.5-6.5l-3.1 3.1-4-1 1-4 3.1-3.1Z"/>',
 car:'<path d="m5 11 2-6h10l2 6M4 11h16v7H4zm2 7v2m12-2v2M7 14h2m6 0h2"/>',
 medical:'<path d="M20 5a5.5 5.5 0 0 0-8 0 5.5 5.5 0 0 0-8 0C-1 12 12 21 12 21s13-9 8-16Z"/><path d="M5 12h4l2-3 2 6 2-3h4"/>',
 missing:'<circle cx="9" cy="7" r="3"/><path d="M3 19v-2a6 6 0 0 1 10-4m2 5 2 2 4-4"/>',
 shield:'<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
 speaker:'<path d="M3 9v6h4l5 4V5L7 9H3Zm13-1a5 5 0 0 1 0 8"/>',
 back:'<path d="m14 6-6 6 6 6"/>',
 gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l-2 2-1.7-.7a1.7 1.7 0 0 0-1.6.5L14 21H10l-.4-2.3a1.7 1.7 0 0 0-1.6-.5l-1.7.7-2-2A1.7 1.7 0 0 0 4.6 15L3 14v-4l1.6-1a1.7 1.7 0 0 0-.3-1.9l2-2 1.7.7a1.7 1.7 0 0 0 1.6-.5L10 3h4l.4 2.3a1.7 1.7 0 0 0 1.6.5l1.7-.7 2 2a1.7 1.7 0 0 0-.3 1.9l1.6 1v4Z"/>',
 play:'<circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4z"/>',
 wifi:'<path d="M2 8a15 15 0 0 1 20 0M5 11a10 10 0 0 1 14 0M8.5 14.5a5 5 0 0 1 7 0"/><circle cx="12" cy="19" r="1" fill="currentColor" stroke="none"/>',
 refresh:'<path d="M20 11a8 8 0 1 0-2.3 6M20 4v7h-7"/>',
 flag:'<path d="M5 21V4m0 1c5-4 9 4 14 0v11c-5 4-9-4-14 0"/>',
 more:'<circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/>',
 book:'<path d="M12 7c-3-2-6-2-9-1v13c3-1 6-1 9 1 3-2 6-2 9-1V6c-3-1-6-1-9 1Zm0 0v13"/>'
};
const DRIVER_APK_ICONS=Object.freeze({
 'nav-bus':'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M7 7V4h10v3"/><circle cx="7.5" cy="20" r="1"/><circle cx="16.5" cy="20" r="1"/><path d="M3 14h18"/>',
 bus:'<path d="M8 6v6m8-6v6M5 17h14M5 6a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v12H5V6Z"/><path d="M7 21v-3m10 3v-3"/>',
 alert:'<path d="m10.3 3.9-8.2 14.2A2 2 0 0 0 3.8 21h16.4a2 2 0 0 0 1.7-2.9L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
 team:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
 pin:'<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
 speaker:'<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/>',
 play:'<circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4z"/>',
 refresh:'<path d="M21 11a9 9 0 1 1-2.7-6.4"/><path d="M21 3v6h-6"/>',
 flag:'<path d="M5 21V4"/><path d="M5 5c3-2 5 2 9 0s5-1 5-1v11c-3-1-5-1-8 0s-4-2-6 0"/>',
 wifi:'<path d="M2 9a15 15 0 0 1 20 0"/><path d="M5 12a10 10 0 0 1 14 0"/><path d="M8.5 15.5a5 5 0 0 1 7 0"/><circle cx="12" cy="19" r="1" fill="currentColor" stroke="none"/>',
 'wifi-off':'<path d="M12 20h.01"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M5 12a10 10 0 0 1 14 0"/><path d="M2 9a15 15 0 0 1 20 0"/><path d="m2 2 20 20"/>',
 shield:'<path d="M12 3 19 6v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6z"/><path d="m9 12 2 2 4-4"/>',
 more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'
});
const icon=(id,cl='')=>'<svg class="ui-icon '+cl+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(DRIVER_APK_ICONS[id]||iconPaths[id]||iconPaths.check)+'</svg>';
const button=(label,action,arg='',kind='light',disabled=false)=>'<button type="button" class="'+kind+'" data-action="'+action+'" data-arg="'+escapeHTML(arg)+'" '+(disabled?'disabled aria-disabled="true" title="Action indisponible à cette étape"':'')+'>'+label+'</button>';

const eventLabel=e=>{
 if(e.type.startsWith('incident_resolved_'))return 'Incident traité (démo)';
 if(e.type.startsWith('incident_'))return INCIDENTS.find(x=>x[1]===e.type.slice(9))?.[0]||'Incident';
 if(e.type.startsWith('synthetic_arrival_'))return 'Arrivée à l’arrêt (simulation)';
 return ({
  presence_confirmed:'Présence confirmée',synthetic_driver_secured:'Bus sécurisé (simulation Chauffeur)',
  synthetic_driver_resumed:'Reprise du trajet (simulation)',
  demo_ready_confirmed:'Prêt au départ',demo_ready_cancelled:'Préparation annulée',
  synthetic_trip_started:'Tournée démarrée (simulation)',board:'Montée',
  alight:'Descente',mark_absent:'Absence déclarée',
  empty_bus_confirmed:'Véhicule vide confirmé',
  synthetic_trip_finished:'Tournée clôturée (simulation)'
 })[e.type]||e.type;
};
const friendlyErrors={
 DEPARTURE_NOT_AUTHORIZED:'Départ bloqué : confirmez présence, sécurisation simulée et switch.',
 READY_PRECONDITIONS_NOT_MET:'Présence et immobilisation fictive requises pour le switch.',
 STOP_CURRENTLY_ACTIVE:'Terminez le pointage avant de continuer.',
 VEHICLE_NOT_SECURED_AT_STOP:'Pointage réservé à un arrêt simulé et sécurisé.',
 VEHICLE_NOT_SECURED:'Le bus doit être immobilisé en simulation.',
 WRONG_PICKUP_STOP:'Cet élève doit monter à un autre arrêt.',
 WRONG_DROPOFF_STOP:'Cet élève doit descendre à un autre arrêt.',
 POINTAGE_PENDING_AT_STOP:'Des élèves doivent encore être pointés à cet arrêt.',
 ABSENCE_REASON_REQUIRED:'Le motif d’absence est obligatoire.',
 ROUTE_NOT_COMPLETED:'Tous les arrêts doivent être atteints.',
 STUDENTS_NOT_RECONCILED:'Des élèves ne sont pas justifiés.',
 EMPTY_BUS_CONFIRMATION_REQUIRED:'Inspection finale du bus requise.',
 OPEN_INCIDENTS:'Des incidents restent ouverts.',
 OPEN_CRITICAL_INCIDENT:'Une alerte critique ouverte bloque la reprise du trajet.',
 CHILDREN_REMAIN:'Il reste des élèves à bord.',
 ALREADY_AT_TERMINUS:'Terminus déjà atteint.'
};
const back=()=>button(icon('back')+' Retour à Ma tournée','back_tour','','back-button');
function tourSubpage(d){
 if(view==='students')return '<section class="card sub-page">'+back()+'<h1>Élèves à bord</h1><p class="hint">Liste fictive : élèves affectés au véhicule et états du pointage.</p>'+
 state.students.map(p=>'<div class="line"><strong>'+escapeHTML(p.id)+'</strong><span>'+
 (p.absent?'Absent':p.alighted?'Descendu':p.boarded?'À bord':'En attente')+'</span></div>').join('')+
 '</section>'+
 (d.atStop?pointagePage(d):'<section class="card"><p class="hint">Le pointage devient accessible à l’arrivée simulée et sécurisée d’un arrêt.</p></section>');
 if(view==='stops')return '<section class="card sub-page">'+back()+'<h1>Itinéraire et arrêts</h1><p class="hint">Itinéraire fictif, aucune position GPS réelle.</p>'+
 state.stops.map((p,i)=>'<div class="line"><strong>'+(i+1)+'. '+escapeHTML(p.name)+'</strong><span>'+(p.id===d.activeStopId?'Arrêt actif':p.reached?'Atteint':'À venir')+'</span></div>').join('')+
 button(icon('pin')+' Simuler arrivée au prochain arrêt','simulate_arrival','','warn full',!d.canSimulateArrival)+'</section>';
 if(view==='closing')return '<section class="card sub-page closing-page">'+back()+
 '<h1>Clôturer la course</h1><p class="hint">Démo locale · inspection finale du bus obligatoire avant la clôture.</p>'+
 d.closure.map(x=>'<div class="closing-check '+(x.ok?'pass':'fail')+'"><span aria-hidden="true">'+(x.ok?'✓':'!')+'</span><strong>'+escapeHTML(x.label)+'</strong><span>'+(x.ok?'Conforme':'À confirmer')+'</span></div>').join('')+
 button('Je confirme le bus vide et clôture (démo)','demo_confirm_empty_and_finish','','primary full',!d.canOpenClosing)+'</section>';
 return '<section class="card sub-page">'+back()+'<h1>Suivi de tournée</h1><p class="hint">Résultats locaux uniquement. Pas de GPS ou de validation Chauffeur réelle.</p>'+
 '<div class="line"><span>État</span><strong>'+escapeHTML(d.status)+'</strong></div>'+
 '<div class="line"><span>Arrêts atteints</span><strong>'+d.stopsReached+'/'+d.stopsTotal+'</strong></div>'+
 '<div class="line"><span>Élèves non justifiés</span><strong>'+d.unaccounted+'</strong></div>'+
 '<div class="line"><span>Réseau fictif</span><strong>'+escapeHTML(d.network)+'</strong></div>'+
 '<h2>Événements</h2>'+(state.events.length?state.events.slice().reverse().map(e=>
 '<div class="line"><span>'+escapeHTML(eventLabel(e))+'</span><small>'+escapeHTML(e.studentId||e.stopId||'Démo locale')+'</small></div>').join(''):'<p class="hint">Aucun événement.</p>')+'</section>';
}
function activeAlertBanner(){
 const opened=state.alerts.filter(a=>a.status==='open').sort((a,b)=>Number(b.critical)-Number(a.critical));
 if(!opened.length)return '';
 const top=opened[0],label=INCIDENTS.find(x=>x[1]===top.kind)?.[0]||'Incident';
 return '<button type="button" class="active-alert-banner" data-action="go_alerts" aria-label="Ouvrir les alertes en cours">'+
  '<strong>'+icon('alert')+' ALERTE ACTIVE'+(opened.length>1?' · +'+(opened.length-1):'')+'</strong>'+
  '<span>'+escapeHTML(label)+' · '+(top.critical?'Critique':'À examiner')+'</span></button>';
}
// Attention is strictly an affordance: never modifies the route or pupil records.
function indicatorAttention(d){
 const pointagePending=d.status==='in_progress'&&d.atStop&&d.driverSecured&&d.pendingAtStop>0;
 const pointagePulse=pointagePending&&pointagePulseSeenAt!==d.activeStopId;
 if(pointagePulse)pointagePulseSeenAt=d.activeStopId;
 const stopPulse=!!stopPulseWaitingFor&&stopPulseWaitingFor===d.activeStopId&&d.stopsReached>0;
 if(stopPulse)stopPulseWaitingFor=null;
 return {pointagePending,pointagePulse,stopPulse};
}
function tourDashboard(d,started,done){
 const attention=indicatorAttention(d);
 return '<section class="tour-dashboard" aria-label="Tableau de bord Accompagnateur"><section class="card tour-hero">'+
 '<div class="tour-heading"><h2>MA TOURNÉE</h2><div class="tour-heading-right"><span class="trip-state '+(started?'state-running':done?'state-complete':'state-preparing')+'">'+
 (started?'● EN COURS':done?'✓ TERMINÉE':'À PRÉPARER')+'</span><span class="network-icon '+(d.network==='simulated-online'?'wifi-online':'wifi-offline')+'" role="img" aria-label="'+(d.network==='simulated-online'?'Wi-Fi simulé actif — sans serveur réel':'Wi-Fi simulé inactif — sans serveur réel')+'" title="Wi-Fi simulé, aucune connexion serveur">'+icon(d.network==='simulated-online'?'wifi':'wifi-off')+'</span></div></div>'+
 '<div class="next-stop"><div class="next-stop-info"><span class="hero-label">'+(d.atStop?'ARRÊT ACTUEL':'PROCHAIN ARRÊT')+'</span><strong>'+escapeHTML(d.atStop?d.activeStopName:d.nextStop)+'</strong></div><span class="sound-icon" title="Annonces vocales non disponibles">'+icon('speaker')+'</span></div>'+
 activeAlertBanner()+
 '<div class="hero-stats">'+
 '<button type="button" class="hero-stat'+(attention.pointagePending?' indicator-pending':'')+(attention.pointagePulse?' indicator-pulse':'')+'" data-action="go_students" aria-label="Élèves à bord : '+d.onboard+(attention.pointagePending?' ; '+d.pendingAtStop+' pointage(s) attendu(s) à l’arrêt actif':'')+'"><span class="hero-label">'+icon('team')+' ÉLÈVES À BORD</span><strong>'+d.onboard+'</strong><span class="stat-chevron">›</span></button>'+
 '<button type="button" class="hero-stat'+(attention.stopPulse?' indicator-new-stop':'')+'" data-action="go_stops" aria-label="Arrêts atteints : '+d.stopsReached+' sur '+d.stopsTotal+(attention.stopPulse?' ; nouvel arrêt confirmé':'')+'"><span class="hero-label">'+icon('pin')+' ARRÊTS ATTEINTS</span><strong>'+d.stopsReached+'/'+d.stopsTotal+'</strong><span class="stat-chevron">›</span></button></div>'+
 '<div class="hero-info">'+
 '<div><span class="hero-symbol">'+icon('bus')+'</span><div><strong>Bus BUS-DÉMO-01 · Circuit fictif A</strong></div></div>'+
 '<div><span class="hero-symbol">'+icon('team')+'</span><div><strong>Équipe affectée · Accompagnateur '+(d.presence?'présent':'à confirmer')+'</strong></div></div>'+
 '<div class="safety-row"><span class="hero-symbol">'+icon('shield')+'</span>'+
 (d.status==='planned'?
  '<div><strong>Prêt au départ · Préparation démo</strong><small>'+(d.ready?'Préparation simulée, aucun accord Chauffeur réel':'Activez le switch pour préparer la simulation')+'</small></div>'+
  '<button type="button" role="switch" aria-label="Prêt au départ (simulation locale, sans validation Chauffeur réelle)" aria-checked="'+d.ready+'" class="safety-switch '+(d.ready?'on':'')+'" data-action="demo_prepare_departure" '+(!d.canDemoPrepare?'disabled':'')+'><span></span></button>':
  d.status==='completed'?
  '<div><strong>Tournée terminée (démo)</strong><small>Clôture et inspection locales enregistrées</small></div><span class="safety-status-mark" aria-hidden="true">'+icon('check')+'</span>':
  d.atStop?
  '<div><strong>Arrêt enregistré · Sécurisation simulée</strong><small>'+(d.pendingAtStop>0?'Pointage à effectuer : '+d.pendingAtStop+' élève(s)':'Pointage terminé'+(d.openAlerts?' · Alerte à traiter':' · Arrêt sécurisé (démo)'))+'</small></div><span class="safety-status-mark" aria-hidden="true">'+icon('check')+'</span>':
  '<div><strong>Trajet en cours (démo)</strong><small>Prochaine arrivée à confirmer en simulation</small></div><span class="safety-status-mark" aria-hidden="true">'+icon('route')+'</span>')+
 '</div></div></section>'+
 '<div class="dashboard-actions" aria-label="Actions rapides">'+
 button(icon('play')+'<span>DÉMARRER LA COURSE</span>','start_demo_trip','','primary dash-action',!d.canStart)+
 button(icon('refresh')+'<span>NOUVELLE TOURNÉE</span>','new_demo_trip','','light dash-action',d.status!=='completed')+
 button(icon('pin')+'<span>ARRÊT ATTEINT</span>',attention.pointagePending?'go_students':'simulate_arrival','','warn dash-action'+(attention.pointagePending?' pointage-direct':''),!(d.canSimulateArrival||attention.pointagePending))+
 button(icon('flag')+'<span>CLÔTURER LA COURSE</span>','go_closing','','light dash-action',!d.canOpenClosing)+
 '</div></section>';
}
function pointagePage(d){
 const here=state.students.filter(p=>d.atStop&&(p.pickupStopId===d.activeStopId||(p.dropoffStopId===d.activeStopId&&p.boarded&&!p.alighted)));
 return '<section class="card pointage-card"><h2>Pointage des élèves</h2>'+
 '<p class="pointage-context">'+(d.atStop?icon('pin')+' Arrêt actif : <strong>'+escapeHTML(d.activeStopName)+'</strong>':'Aucun arrêt actif. Simulez une arrivée depuis Ma tournée.')+'</p>'+
 '<p class="hint">Seules les actions relatives aux élèves attendus à cet arrêt sont proposées.</p>'+
 (here.length?here.map(p=>{
  const pickup=p.pickupStopId===d.activeStopId;
  const status=p.absent?'Absent · '+(p.absenceReason==='non_present'?'non présenté':'famille informée'):p.alighted?'Descendu':p.boarded?'À bord':'En attente';
  const actions=pickup?
   button('Monter','board',p.id,'light',p.absent||p.boarded||!d.driverSecured)+
   button('Absent · non présenté','mark_absent',p.id,'subtle',p.absent||p.boarded||!d.driverSecured):
   button('Descendre','alight',p.id,'warn',!p.boarded||p.alighted||!d.driverSecured);
  return '<div class="student-line"><div><strong>'+escapeHTML(p.id)+'</strong><div class="status">'+escapeHTML(status)+' · '+(pickup?'Montée':'Descente')+'</div></div><div class="buttons">'+actions+'</div></div>';
 }).join(''):'<p class="hint">Aucun élève attendu à cet arrêt.</p>')+'</section>'+
 (d.atStop?'<section class="card stop-actions"><div class="line"><strong>Pointages restants</strong><strong>'+d.pendingAtStop+'</strong></div>'+
 (d.canResume?'<p class="hint">Pointage terminé : retour automatique au tableau de bord pour l’arrêt suivant.</p>':'')+
 (d.stopsReached===d.stopsTotal?button('Vérifier la clôture','go_closing','','primary full',d.pendingAtStop>0):'')+
 (d.pendingAtStop?'<p class="hint">Départ de l’arrêt bloqué jusqu’au pointage complet.</p>':'')+'</section>':'');
}
function alertPage(d){
 const icons={traffic:'traffic',delay:'clock',breakdown:'wrench',accident:'car',medical:'medical',missing_child:'missing'};
 return '<section class="card alerts-card"><p class="alert-instruction">Pour signaler une alerte, immobilisez et sécurisez le bus, puis choisissez le type d’incident.</p>'+
 '<details class="safety-details"><summary>Consignes de sécurité</summary><p class="hint">Les situations critiques peuvent être signalées sans attendre une confirmation d’arrêt. Contactez directement les secours conformément au protocole : cette DÉMO NE CONTACTE PERSONNE.</p></details>'+
 '<div class="alert-grid">'+INCIDENTS.map(([name,id])=>button(icon(icons[id])+'<span>'+escapeHTML(name)+'</span>','incident',id,'alert-tile '+id,!CRITICAL_INCIDENTS.includes(id)&&!d.canReportIncidents)).join('')+'</div>'+
 '<p class="hint">Urgence critique : action accessible même en déplacement. Incidents ordinaires : arrêt sécurisé requis. Aucun envoi réel.</p></section>'+
 '<section class="card alerts-log"><h2>Suivi des alertes</h2>'+ 
 (d.status==='planned'&&d.openAlerts>0&&!d.driverSecured?button('Confirmer bus immobilisé (démo)','simulate_driver_secure','','light full'):'')+
 (state.alerts.length?state.alerts.slice().reverse().map(a=>
 '<div class="alert-entry"><div><strong>'+escapeHTML(INCIDENTS.find(x=>x[1]===a.kind)?.[0]||a.kind)+'</strong><small>'+
 (a.status==='open'?'Ouverte · démo locale':'Traitée en démo · aucun envoi')+'</small></div>'+
 (a.status==='open'?button('Traiter (démo)','resolve_incident',a.id,'light',!d.canReportIncidents&&!(d.status==='planned'&&d.driverSecured)):'')+'</div>').join(''):
 '<p class="empty-alerts">Aucune alerte enregistrée.</p>')+'</section>';
}
function teamPage(d,done){
 return '<section class="card"><h2>Équipe affectée (fictive)</h2><div class="line"><span>Chauffeur</span><strong>CHAUFFEUR-DÉMO</strong></div><div class="line"><span>Accompagnateur</span><strong>ATT-DEMO</strong></div><div class="line"><span>Présence</span><strong>'+(d.presence?'Confirmée':'À confirmer')+'</strong></div>'+
 '<p class="hint">La validation croisée entre deux comptes n\'est pas encore activée. La préparation et le départ fictifs sont centralisés dans Ma tournée.</p>'+
 button('Retour à la préparation','back_tour','','light full')+'</section>'+
 '<section class="card"><h2>Session</h2><div class="line"><span>Environnement</span><strong>DÉMO</strong></div><p class="hint">Aucune synchronisation distante, même si le réseau simulé est connecté.</p>'+
 button('Simuler coupure / retour réseau','network','','light full')+button('Réinitialiser la simulation','reset','','light full')+'</section>';
}
function morePage(d){
 if(view==='journal')return tourSubpage(d);
 if(view==='voice')return '<section class="card sub-page">'+back()+'<h1>Annonces vocales</h1><p class="hint">Synthèse vocale indisponible dans cette démonstration isolée. Aucune annonce n’est envoyée.</p>'+button('Écouter le prochain arrêt (indisponible)','noop','','light full',true)+'</section>';
 if(view==='sync')return '<section class="card sub-page">'+back()+'<h1>Connexion et synchronisation</h1><p class="hint">DEMO — Sans serveur réel. La connexion Wi-Fi affichée sur Ma tournée est exclusivement simulée.</p>'+
 '<div class="line"><span>Réseau simulé</span><strong>'+(d.network==='simulated-online'?'Actif':'Inactif')+'</strong></div>'+
 '<div class="line"><span>Événements transmis</span><strong>0</strong></div>'+
 button('Simuler coupure / retour Wi-Fi','network','','light full')+
 button('Réinitialiser cette démo','reset','','subtle full')+'</section>';
 return '<section class="card more-tools"><h1>Outils</h1>'+
 button(icon('book')+' Journal des tournées','go_journal','','light full')+
 button(icon('speaker')+' Annonces vocales','go_voice','','light full')+
 button(icon('refresh')+' Connexion et synchronisation','go_sync','','light full')+'</section>';
}
function content(){
 const d=attendantSummary(state),started=d.status==='in_progress',done=d.status==='completed';
 if(tab==='tour'&&view!=='dashboard')return tourSubpage(d);
 if(tab==='tour')return tourDashboard(d,started,done);
 if(tab==='alerts')return alertPage(d);
 if(tab==='team')return teamPage(d,done);
 return morePage(d);
}
const navEntries=[['tour','▣','Ma tournée'],['alerts','⚠','Alertes'],['team','♧','Équipe'],['more','•••','Plus']];
const navIcon={tour:'nav-bus',alerts:'alert',team:'team',more:'more'};
function render(){
 const tabLabel={tour:'Ma tournée',alerts:'Alertes',team:'Équipe',more:'Plus'};
 root.innerHTML='<div class="app"><header class="head"><div class="brand"><div class="brand-left">'+
 '<span class="brand-mark" role="img" aria-label="Logo officiel A2S Scola">▣</span>'+
 '<div><div class="brand-name">A2S Scola</div><div class="brand-sub">Profil Accompagnateur · Démo</div></div></div>'+
 '<span class="settings-symbol" title="Réglages indisponibles dans cette démonstration">'+icon('gear')+'</span></div>'+
 '<div class="demo-pill" aria-label="Environnement démonstration, sans serveur réel">DÉMO · Sans serveur réel</div></header>'+
 '<main class="content" aria-label="'+tabLabel[tab]+'">'+
 (tab!=='tour'?'<h1 class="page-title">'+tabLabel[tab]+'</h1>':'')+
 (message?'<div class="error" role="status">'+escapeHTML(message)+'</div>':'')+
 content()+'</main>'+
 '<nav class="bottom" aria-label="Menus accompagnateur">'+navEntries.map(([id,legacyIcon,label])=>
 '<button type="button" data-tab="'+id+'" class="'+(tab===id?'active':'')+'" '+(tab===id?'aria-current="page"':'')+'>'+
 '<span class="nav-icon">'+icon(navIcon[id])+'</span><span class="nav-label">'+label+'</span></button>').join('')+
 '</nav></div>';
}
root.addEventListener('click',e=>{
 const target=e.target.closest('button');if(!target||target.disabled)return;
 message='';
 if(target.dataset.tab){tab=target.dataset.tab;view='dashboard';render();return;}
 const action=target.dataset.action;if(!action)return;
 try{
  if(action==='go_boarding'||action==='go_alerts'||action==='go_team'){
   tab=action==='go_boarding'?'tour':action==='go_alerts'?'alerts':'team';view=action==='go_boarding'?'students':'dashboard';
   if(action==='go_team')message='Validation croisée réelle indisponible : équipe fictive uniquement.';
  }else if(action==='go_followup'||action==='go_students'||action==='go_stops'){
   tab='tour';view=action==='go_followup'?'followup':action==='go_students'?'students':'stops';
  }else if(action==='go_closing'){
   tab='tour';view='closing';
  }else if(action==='go_journal'||action==='go_voice'||action==='go_sync'){
   tab='more';view=action==='go_journal'?'journal':action==='go_voice'?'voice':'sync';
  }
  else if(action==='back_tour'){tab='tour';view='dashboard';}
  else if(action==='reset'){state=makeAttendantDemo();tab='tour';view='dashboard';pointagePulseSeenAt=null;stopPulseWaitingFor=null;}
  else if(action==='network')state=runAttendantDemo(state,state.network==='simulated-online'?'simulate_network_loss':'simulate_network_return');
  else if(action==='new_demo_trip'){
   if(state.trip.status!=='completed')throw Error('TRIP_NOT_COMPLETED');
   state=makeAttendantDemo();tab='tour';view='dashboard';pointagePulseSeenAt=null;stopPulseWaitingFor=null;
  }
  else{
   const actual=action==='incident'?'report_incident':action;
   const args=action==='incident'?{incident:target.dataset.arg}:
    action==='resolve_incident'?{incidentId:target.dataset.arg}:
    action==='mark_absent'?{studentId:target.dataset.arg,reason:'non_present'}:
    {studentId:target.dataset.arg};
   state=runAttendantDemo(state,actual,args);
   if(action==='start_demo_trip'||action==='simulate_driver_resume'||action==='finish_demo_trip'||action==='demo_confirm_empty_and_finish'){tab='tour';view='dashboard';}
   if(action==='simulate_arrival'){
    const arrived=attendantSummary(state);
    stopPulseWaitingFor=arrived.activeStopId;
    // In DEMO only: an intermediate stop without scheduled pupils can continue
    // after the synthetic standstill; closing/critical incidents remain guarded.
    if(arrived.pendingAtStop===0&&arrived.canResume){
     state=runAttendantDemo(state,'simulate_driver_resume');
    }
    tab='tour';view='dashboard';
   }
   if(action==='resolve_incident'){
    const safe=attendantSummary(state);
    // A critical incident blocks resume until explicitly resolved.
    // Only the simulated trip (never a real vehicle) resumes after resolution.
    if(safe.canResume){
     state=runAttendantDemo(state,'simulate_driver_resume');
     tab='tour';view='dashboard';
    }
   }
   if(action==='board'||action==='alight'||action==='mark_absent'){
    const latest=attendantSummary(state);
    if(latest.atStop&&latest.pendingAtStop===0){
     // Only DEMO resumes automatically, after all pointages and safety blockers are cleared.
     if(latest.canResume)state=runAttendantDemo(state,'simulate_driver_resume');
     tab='tour';view='dashboard';
    }
   }
  }
 }catch(err){message='Action refusée : '+(friendlyErrors[err.message]||err.message);}
 render();
});render();
