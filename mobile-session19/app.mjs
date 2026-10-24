import {makeAttendantDemo,runAttendantDemo,attendantSummary,INCIDENTS} from './attendant-demo.mjs';
let state=makeAttendantDemo(),tab='tour',view='dashboard',message='';
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
 play:'<circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4z"/>'
};
const icon=(id,cl='')=>'<svg class="ui-icon '+cl+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(iconPaths[id]||iconPaths.check)+'</svg>';
const button=(label,action,arg='',kind='light',disabled=false)=>'<button type="button" class="'+kind+'" data-action="'+action+'" data-arg="'+escapeHTML(arg)+'" '+(disabled?'disabled':'')+'>'+label+'</button>';
const eventLabel=e=>{
 if(e.type.startsWith('incident_'))return INCIDENTS.find(x=>x[1]===e.type.slice(9))?.[0]||'Incident';
 if(e.type.startsWith('stop_reached_'))return 'Arrêt atteint';
 return ({
  presence_confirmed:'Présence confirmée',synthetic_driver_secured:'Bus sécurisé (simulation Chauffeur)',
  synthetic_driver_resumed:'Départ de l’arrêt (simulation)',
  demo_ready_confirmed:'Prêt au départ',demo_ready_cancelled:'Préparation annulée',
  synthetic_trip_started:'Tournée démarrée (simulation)',board:'Montée',
  alight:'Descente',mark_absent:'Absence déclarée',
  empty_bus_confirmed:'Véhicule vide confirmé',
  synthetic_trip_finished:'Tournée clôturée (simulation)'
 })[e.type]||e.type;
};
const back=()=>button(icon('back')+' Retour à Ma tournée','back_tour','','back-button');
function content(){
 const d=attendantSummary(state),started=d.status==='in_progress',done=d.status==='completed';
 if(tab==='tour'&&view!=='dashboard'){
  if(view==='students')return '<section class="card sub-page">'+back()+'<h1>Élèves à bord</h1><p class="hint">Liste fictive des élèves affectés au bus. Touchez Pointage pour enregistrer une montée ou descente.</p>'+
   state.students.map(s=>'<div class="line"><strong>'+escapeHTML(s.id)+'</strong><span>'+(s.absent?'Absent':s.alighted?'Descendu':s.boarded?'À bord':'À pointer')+'</span></div>').join('')+
   button('Ouvrir Pointage','go_boarding','','primary full')+'</section>';
  if(view==='stops')return '<section class="card sub-page">'+back()+'<h1>Itinéraire et arrêts</h1><p class="hint">Itinéraire fictif, sans position GPS. Chaque arrivée nécessite une immobilisation simulée distincte.</p>'+
   state.stops.map((stop,i)=>'<div class="line"><strong>'+(i+1)+'. '+escapeHTML(stop.name)+'</strong><span>'+(stop.reached?'Atteint':'À venir')+'</span></div>').join('')+
   button(icon('pin')+' Marquer le prochain arrêt atteint (démo)','reach_stop','','warn full',!started||!d.driverSecured||d.stopsReached===d.stopsTotal)+'</section>';
  return '<section class="card sub-page">'+back()+'<h1>Suivi de tournée</h1><p class="hint">Résultats locaux de la simulation uniquement. Aucune position GPS ou validation réelle du Chauffeur.</p>'+
   '<div class="line"><span>État de la tournée</span><strong>'+escapeHTML(d.status)+'</strong></div>'+
   '<div class="line"><span>Arrêts atteints</span><strong>'+d.stopsReached+'/'+d.stopsTotal+'</strong></div>'+
   '<div class="line"><span>Élèves non justifiés</span><strong>'+d.unaccounted+'</strong></div>'+
   '<div class="line"><span>Réseau fictif</span><strong>'+escapeHTML(d.network)+'</strong></div>'+
   '<h2>Événements</h2>'+(state.events.length?state.events.slice().reverse().map(e=>'<div class="line"><span>'+escapeHTML(eventLabel(e))+'</span><small>'+escapeHTML(e.studentId||'Démo locale')+'</small></div>').join(''):'<p class="hint">Aucun événement.</p>')+'</section>';
 }
 if(tab==='tour')return `<section class="tour-dashboard" aria-label="Tableau de bord Accompagnateur">
<section class="card tour-hero">
 <div class="tour-heading"><h2>MA TOURNÉE</h2><div class="tour-heading-right"><span class="trip-state">${started?'● EN COURS':done?'✓ TERMINÉE':'○ À PRÉPARER'}</span><span class="network-icon" title="Liaison fictive seulement" aria-label="Réseau simulé">⌁</span></div></div>
 <div class="next-stop"><div><span class="hero-label">PROCHAIN ARRÊT</span><strong>${escapeHTML(d.nextStop)}</strong></div><span class="sound-icon" title="Annonces vocales non disponibles">${icon('speaker')}</span></div>
 <div class="hero-stats">
  <button type="button" class="hero-stat" data-action="go_students"><span class="hero-label">${icon('team')} ÉLÈVES À BORD</span><strong>${d.onboard}</strong><span class="stat-chevron">›</span></button>
  <button type="button" class="hero-stat" data-action="go_stops"><span class="hero-label">${icon('pin')} ARRÊTS ATTEINTS</span><strong>${d.stopsReached}/${d.stopsTotal}</strong><span class="stat-chevron">›</span></button>
 </div>
 <div class="hero-info">
  <div><span class="hero-symbol">${icon('bus')}</span><div><strong>Bus BUS-DÉMO-01 · Circuit fictif A</strong></div></div>
  <div><span class="hero-symbol">${icon('team')}</span><div><strong>Équipe affectée · Accompagnateur ${d.presence?'présent':'à confirmer'}</strong></div></div>
  <div class="safety-row"><span class="hero-symbol">${icon('shield')}</span><div><strong>Prêt au départ · Bus immobilisé et sécurisé</strong><small>${d.driverSecured?'Confirmation fictive du Chauffeur enregistrée':'Confirmation fictive du Chauffeur requise'}</small></div>
   <button type="button" role="switch" aria-label="Prêt au départ (simulation)" aria-checked="${d.ready}" class="safety-switch ${d.ready?'on':''}" data-action="toggle_ready" ${!d.canToggleReady?'disabled':''}><span></span></button></div>
 </div>
</section>
<div class="dashboard-actions" aria-label="Actions rapides">
${button(icon('check')+'<span>POINTAGE DES ÉLÈVES</span>','go_boarding','','primary dash-action')}
${button(icon('shield')+'<span>VALIDATION CROISÉE</span>','go_team','','light dash-action')}
${button(icon('alert')+'<span>SIGNALER UN INCIDENT</span>','go_alerts','','warn dash-action')}
${button(icon('route')+'<span>SUIVI DE TOURNÉE</span>','go_followup','','light dash-action')}
</div></section>`;
 if(tab==='boarding')return '<section class="card"><h2>Pointage des élèves</h2><p class="hint">Élèves fictifs. Montées, descentes et absences enregistrées uniquement à l’arrêt sécurisé (démo).</p>'+
 state.students.map(s=>'<div class="student-line"><div><strong>'+escapeHTML(s.id)+'</strong><div class="status">'+(s.absent?'Absent':s.alighted?'Descendu':s.boarded?'À bord':'En attente')+'</div></div><div class="buttons">'+
 button('Monter','board',s.id,'light',!started||!d.driverSecured||s.absent||s.boarded)+
 button('Descendre','alight',s.id,'warn',!started||!d.driverSecured||!s.boarded||s.alighted)+
 button('Absent','mark_absent',s.id,'subtle',!started||!d.driverSecured||s.absent||s.boarded)+'</div></div>').join('')+
 '</section><section class="card"><h2>Contrôle final</h2><p class="hint">Élèves non justifiés : <strong>'+d.unaccounted+'</strong>. La clôture exige tous les arrêts atteints, les élèves réconciliés et une vérification physique du véhicule.</p>'+
 button('Confirmer véhicule vide (démo)','confirm_empty','','light full',!started||!d.driverSecured||d.onboard>0||state.events.some(x=>x.type==='empty_bus_confirmed'))+
 button('Clôturer la simulation','finish_demo_trip','','primary full',!started||!d.driverSecured||d.onboard>0||d.unaccounted>0||d.stopsReached!==d.stopsTotal||!state.events.some(x=>x.type==='empty_bus_confirmed'))+'</section>';
 if(tab==='alerts'){
  const icons={traffic:'traffic',delay:'clock',breakdown:'wrench',accident:'car',medical:'medical',missing_child:'missing'};
  return '<section class="card alerts-card"><p class="alert-instruction">Pour signaler une alerte, immobilisez et sécurisez le bus, puis choisissez le type d’incident.</p>'+
   '<details class="safety-details"><summary>Consignes de sécurité</summary><p class="hint">Faire immobiliser et sécuriser le bus. En cas d’urgence, suivre les procédures de secours de l’établissement. Cette démo ne transmet aucune alerte.</p></details>'+
   '<div class="alert-grid">'+INCIDENTS.map(([name,id])=>button(icon(icons[id])+'<span>'+escapeHTML(name)+'</span>','incident',id,'alert-tile '+id,!d.canReportIncidents)).join('')+'</div>'+
   (!d.canReportIncidents?'<p class="hint">Signalement activé uniquement pendant une tournée et après confirmation fictive de l’immobilisation.</p>':'')+
   '</section><section class="card alerts-log"><h2>Suivi des alertes</h2>'+
   (state.events.filter(x=>x.type.startsWith('incident_')).length?
    state.events.filter(x=>x.type.startsWith('incident_')).slice().reverse().map(e=>'<div class="line"><strong>'+escapeHTML(eventLabel(e))+'</strong><small>Démo locale · aucun envoi</small></div>').join(''):
    '<p class="empty-alerts">Aucune alerte enregistrée.</p>')+'</section>';
 }
 return '<section class="card"><h2>Équipe affectée (fictive)</h2><div class="line"><span>Chauffeur</span><strong>CHAUFFEUR-DÉMO</strong></div><div class="line"><span>Accompagnateur</span><strong>ATT-DEMO</strong></div><div class="line"><span>Présence</span><strong>'+(d.presence?'Confirmée':'À confirmer')+'</strong></div>'+
  button('Confirmer ma présence','confirm_presence','','primary full',d.presence||done)+
  '<p class="hint">La validation croisée entre deux comptes n\'est pas encore activée. Les actions ci-dessous créent seulement des événements fictifs de Chauffeur, sans modifier ses droits réels.</p>'+
  button('Simuler bus immobilisé et sécurisé','simulate_driver_secure','','light full',done||d.driverSecured)+
  button('Simuler la reprise du mouvement','simulate_driver_resume','','light full',!started||!d.driverSecured)+
  button('Démarrer la tournée simulée','start_demo_trip','','primary full',!d.ready||d.status!=='planned')+'</section>'+
  '<section class="card"><h2>Session</h2><div class="line"><span>Environnement</span><strong>DÉMO</strong></div><p class="hint">Sans synchronisation distante, même lorsque le réseau simulé est connecté.</p>'+
  button('Simuler coupure / retour réseau','network','','light full')+
  button('Réinitialiser la simulation','reset','','light full')+'</section>';
}
const navEntries=[['tour','▣','Ma tournée'],['alerts','⚠','Alertes'],['boarding','☑','Pointage'],['team','♧','Équipe']];
const navIcon={tour:'bus',alerts:'alert',boarding:'check',team:'team'};
function render(){
 const tabLabel={tour:'Ma tournée',boarding:'Pointage',alerts:'Alertes',team:'Équipe'};
 root.innerHTML=`<div class="app"><header class="head">
  <div class="brand"><div class="brand-left"><span class="brand-mark" role="img" aria-label="Logo officiel A2S Scola">▣</span><div><div class="brand-name">A2S Scola</div><div class="brand-sub">Profil Accompagnateur · Démo</div></div></div><span class="settings-symbol" title="Réglages indisponibles dans cette démonstration">${icon('gear')}</span></div>
  <div class="demo-pill" aria-label="Environnement de démonstration, sans serveur réel">DÉMO · Sans serveur réel</div></header>
  <main class="content" aria-label="${tabLabel[tab]}">
  ${tab!=='tour'?'<h1 class="page-title">'+tabLabel[tab]+'</h1>':''}
  ${message?'<div class="error" role="status">'+escapeHTML(message)+'</div>':''}
  ${content()}</main>
  <nav class="bottom" aria-label="Menus accompagnateur">${navEntries.map(([id,legacyIcon,label])=>'<button type="button" data-tab="'+id+'" class="'+(tab===id?'active':'')+'" '+(tab===id?'aria-current="page"':'')+'><span class="nav-icon">'+icon(navIcon[id])+'</span><span class="nav-label">'+label+'</span></button>').join('')}</nav>
  </div>`;
}
root.addEventListener('click',e=>{
 const target=e.target.closest('button');if(!target||target.disabled)return;
 message='';
 if(target.dataset.tab){tab=target.dataset.tab;view='dashboard';render();return;}
 const action=target.dataset.action;if(!action)return;
 try{
  if(action==='go_boarding'||action==='go_alerts'||action==='go_team'){
   tab=action==='go_boarding'?'boarding':action==='go_alerts'?'alerts':'team';view='dashboard';
   if(action==='go_team')message='Validation croisée réelle indisponible : équipe fictive seulement.';
  }else if(action==='go_followup'||action==='go_students'||action==='go_stops'){
   tab='tour';view=action==='go_followup'?'followup':action==='go_students'?'students':'stops';
  }else if(action==='back_tour'){tab='tour';view='dashboard';}
  else if(action==='reset'){state=makeAttendantDemo();tab='tour';view='dashboard';}
  else if(action==='network')state=runAttendantDemo(state,state.network==='simulated-online'?'simulate_network_loss':'simulate_network_return');
  else {state=runAttendantDemo(state,action==='incident'?'report_incident':action,action==='incident'?{incident:target.dataset.arg}:{studentId:target.dataset.arg});
   if(action==='start_demo_trip'){tab='tour';view='dashboard';}
  }
 }catch(err){message='Action refusée : '+err.message;}
 render();
});render();
