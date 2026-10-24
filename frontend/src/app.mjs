import {
  accounts, makeState, routeOf, vehicleOf, driverOf, tripOf, visibleStudents, visibleTrips,
  visibleVehicles, visibleIncidents, visibleNotifications, statusName,
  addStudent, addVehicle, assignDriver, startTrip, advanceTrip, setDriverOnline,
  boardStudent, finishTrip, reportIncident, resolveIncident, toggleAbsence,
  toggleAlerts, readNotifications
} from './domain.mjs';

let state = makeState();
let role = 'admin';
let view = 'overview';
let toast = '';
let mobileNavOpen = false;
const root = document.getElementById('app');
const actor = () => accounts[role];
const nav = {
  admin: [ ['overview','Tableau de bord','layout'],['students','Références élèves','users'],['routes','Tournées scolaires','route'],['partners','Établissement','building'] ],
  operator: [ ['overview','Tableau de bord','layout'],['fleet','Ma flotte','bus'],['assignments','Affectations','calendar'],['incidents','Incidents','alert'] ],
  driver: [ ['overview','Ma tournée','route'],['boarding','Prise en charge','check'],['incidents','Signaler un incident','alert'] ],
  parent: [ ['overview','Suivi de mon bus','location'],['children','Mes références','users'],['notifications','Notifications','bell'] ]
};
const icons = {
  bus:'<path d="M5 17V6a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v11M5 14h14M7 21v-4m10 4v-4M5 9h14"/><circle cx="8" cy="17" r="1"/><circle cx="16" cy="17" r="1"/>',
  layout:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  users:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M20 20v-2a6 6 0 0 0-4-5.7"/>',
  route:'<circle cx="6" cy="5" r="2"/><circle cx="18" cy="19" r="2"/><path d="M6 7v8a4 4 0 0 0 4 4h6M10 5h8v8"/>',
  building:'<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h2m3 0h2M9 11h2m3 0h2M9 15h2m3 0h2M11 21v-4h2v4"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  alert:'<path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v4m0 4h.01"/>',
  location:'<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  shield:'<path d="m12 2 9 4v6c0 5.5-4 8.5-9 10-5-1.5-9-4.5-9-10V6l9-4Z"/><path d="m8 12 3 3 5-6"/>',
  arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
  menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  reset:'<path d="M3 12a9 9 0 1 0 3-6.7M3 3v6h6"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  signal:'<path d="M3 20v-3m5 3v-7m5 7v-11m5 11V5"/>',
  chevron:'<path d="m6 9 6 6 6-6"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-9h.01"/>',
  double:'<path d="m7 7 5 5-5 5m6-10 5 5-5 5"/>',
  wifi:'<path d="M2 9a15 15 0 0 1 20 0M5 13a10 10 0 0 1 14 0M9 17a4 4 0 0 1 6 0M12 21h.01"/>',
  offline:'<path d="M2 9a15 15 0 0 1 20 0M5 13a10 10 0 0 1 14 0M12 21h.01M3 3l18 18"/>'
};
const ico = (name,cls='') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[name]||icons.info}</svg>`;
const esc = value => String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const tag = (status) => `<span class="status status-${esc(status)}"><span class="status-dot"></span>${esc(statusName(status))}</span>`;
const getSchool = id => state.schools.find(x=>x.id===id);
const getOperator = id => state.operators.find(x=>x.id===id);
const assignedStudents = trip => state.students.filter(s=>s.tripId===trip.id);
const number = n => new Intl.NumberFormat('fr-CD').format(n);
const cdf = n => `${number(n)} CDF`;
const notice = (type,title,body) => `<div class="${type}">${ico('info')}<div><strong>${title}</strong><p>${body}</p></div></div>`;
const action = (label,actionName,id='',variant='primary',disabled=false) => `<button class="btn btn-${variant}" data-action="${esc(actionName)}" data-id="${esc(id)}" ${disabled?'disabled':''}>${label}</button>`;
const h = (title,subtitle,extra='') => `<div class="section-heading"><div><h2>${title}</h2><p>${subtitle}</p></div>${extra}</div>`;
function stats(cards){return `<div class="stats-grid">${cards.map(c=>`<article class="stat-card"><div class="stat-top"><span class="stat-label">${c.label}</span><span class="stat-icon">${ico(c.icon)}</span></div><div class="stat-value">${c.value}</div><div class="stat-foot">${c.foot||'Scénario fictif'}</div></article>`).join('')}</div>`;}
function tripTile(t,showActions=false){
  const r=routeOf(state,t),bus=vehicleOf(state,t),driver=driverOf(state,t);
  return `<div class="trip-row"><span class="trip-marker">${ico('bus')}</span><div class="trip-info"><strong>${esc(r?.name)}</strong><span>${esc(bus?.code)} · ${esc(driver?.ref)} · Départ ${esc(t.time)}</span></div><div class="trip-end">${tag(t.status)}<span class="tiny">${esc(t.eta)} estimé</span></div>${showActions&&role==='driver'&&t.status==='planned'?action('Démarrer','start',t.id):''}</div>`;
}
function progressTrack(t){
 const r=routeOf(state,t),p=role==='parent'?t.publishedProgress:t.progress;
 return `<div class="route-visual"><div class="route-visual-top"><div><span class="eyebrow">Progression du circuit · simulation</span><h3>${esc(r.name)}</h3></div><strong>${p}%</strong></div><div class="progress-line"><span style="width:${p}%"></span></div><div class="route-stops">${r.stops.map((stop,i)=>`<div class="route-stop ${p>=i/(r.stops.length-1)*100?'passed':''}"><span class="stop-dot"></span><small>${esc(stop)}</small></div>`).join('')}</div></div>`;
}
function historyFeed(){return `<div class="feed">${state.history.slice(0,5).map(e=>`<div class="feed-row"><span class="feed-dot"></span><p>${esc(e.label)}</p></div>`).join('')}</div>`;}
function adminOverview(){
 const trips=visibleTrips(state,actor());const students=visibleStudents(state,actor());
 return `${h('Vue générale','Une lecture simple des opérations de votre établissement.',`<span class="date-chip">${ico('calendar')} Journée simulée</span>`)}
 ${stats([{label:'Élèves référencés',value:number(students.length),icon:'users',foot:'Références anonymes seulement'},{label:'Tournées prévues',value:number(trips.length),icon:'route',foot:'École Horizon (fictive)'},{label:'Transporteurs partenaires',value:1,icon:'building',foot:'Accord de démonstration'},{label:'Tournées en cours',value:trips.filter(t=>t.status==='in_progress').length,icon:'signal',foot:'Aucune donnée GPS réelle'}])}
 <div class="content-grid"><section class="panel"><div class="panel-head"><h3>Tournées de l’établissement</h3><button class="text-btn" data-nav="routes">Tout voir ${ico('arrow')}</button></div>${trips.map(t=>tripTile(t)).join('')}</section><section class="panel secondary-panel"><h3>Activité du prototype</h3><p class="muted">Les changements restent dans cette session, sans compte ni base distante.</p>${historyFeed()}</section></div>`;
}
function adminStudents(){const students=visibleStudents(state,actor());return `${h('Références élèves','Un identifiant fictif suffit pour tester les parcours sans nom d’enfant.')}
 <div class="content-grid narrow-main"><section class="panel"><div class="panel-head"><h3>Répertoire scolaire</h3><span class="muted small">${students.length} références</span></div><div class="responsive-table"><table><thead><tr><th>Référence</th><th>Tournée</th><th>Statut</th></tr></thead><tbody>${students.map(st=>`<tr><td><strong>${esc(st.ref)}</strong></td><td>${esc(st.tripId?routeOf(state,tripOf(state,st.tripId))?.name:'Non affecté')}</td><td>${st.tripId?'<span class="pill teal">Affecté</span>':'<span class="pill">À affecter</span>'}</td></tr>`).join('')}</tbody></table></div></section>
 <section class="panel"><h3>Ajouter une référence fictive</h3><p class="muted">Aucun nom, numéro de téléphone ni renseignement personnel.</p><form data-form="student" class="stack-form"><label for="studentRef">Identifiant de démonstration</label><input id="studentRef" name="ref" maxlength="28" minlength="2" placeholder="Ex. Élève A-04" required><button type="submit" class="btn btn-primary">${ico('plus')} Créer la référence</button></form>${notice('subtle-notice','Règle de sécurité','Ce formulaire appartient seulement à l’école affichée. La liaison parent–enfant exige une validation distincte.')}</section></div>`;}
function adminRoutes(){return `${h('Tournées scolaires','Parcours de l’établissement, sans suivi de localisation réelle.')}
 <section class="panel">${visibleTrips(state,actor()).map(t=>`<div class="trip-detail">${tripTile(t)}${progressTrack(t)}<div class="list-foot">${assignedStudents(t).length} références affectées · Établissement : ${esc(getSchool(routeOf(state,t).schoolId)?.name)}</div></div>`).join('')}</section>`;}
function adminPartners(){let s=getSchool(actor().schoolId),routes=state.routes.filter(x=>x.schoolId===s.id);return `${h('Établissement et partenaires','Les périmètres d’autorisation sont fixés dans le jeu de démonstration.')}
 <div class="content-grid"><section class="panel profile-panel"><span class="avatar-large">EH</span><h3>${esc(s.name)}</h3><p class="muted">${esc(s.zone)} · Établissement fictif</p><div class="detail-lines"><div><span>Transporteur autorisé</span><strong>${esc(getOperator('OP-A').name)}</strong></div><div><span>Circuits actifs</span><strong>${routes.length}</strong></div><div><span>Profil simulé</span><strong>Administrateur scolaire</strong></div></div></section><section class="panel"><h3>Contrôles et limites</h3>${notice('info-note','Accès limité à l’école','Cet espace ne permet pas de modifier les élèves de l’établissement B.')}${notice('info-note','Validation des responsables','Aucun nouveau lien parent–élève n’est créé automatiquement.')}${notice('info-note','Pas de compte réel','Le sélecteur de profil ne remplace pas une authentification OIDC.')}</section></div>`;}
function operatorOverview(){const trips=visibleTrips(state,actor()),vehicles=visibleVehicles(state,actor()),open=visibleIncidents(state,actor()).filter(i=>i.status==='open');return `${h('Centre de transport','Visibilité restreinte au transporteur sélectionné dans ce scénario.')}
 ${stats([{label:'Bus dans la flotte',value:vehicles.length,icon:'bus',foot:'Transport Kivu (fictif)'},{label:'Tournées attribuées',value:trips.length,icon:'route',foot:'Sans autres transporteurs'},{label:'Chauffeurs actifs',value:state.drivers.filter(x=>x.operatorId===actor().operatorId&&x.active).length,icon:'users',foot:'Profils fictifs'},{label:'Incidents ouverts',value:open.length,icon:'alert',foot:'Gestion simulée'}])}
 <div class="content-grid"><section class="panel"><div class="panel-head"><h3>Départs et tournées</h3><button data-nav="assignments" class="text-btn">Affectations ${ico('arrow')}</button></div>${trips.map(t=>tripTile(t)).join('')}</section><section class="panel"><h3>État de la flotte</h3>${vehicles.map(v=>`<div class="vehicle-line"><span class="vehicle-symbol">${ico('bus')}</span><div><strong>${esc(v.code)}</strong><p>${v.seats} places · Disponible</p></div><span class="pill teal">Vérifié (démo)</span></div>`).join('')}</section></div>`;}
function operatorFleet(){const vehicles=visibleVehicles(state,actor());return `${h('Ma flotte','Ajoutez un bus fictif au transporteur A uniquement.')}
 <div class="content-grid narrow-main"><section class="panel"><div class="panel-head"><h3>Véhicules enregistrés</h3><span class="muted">${vehicles.length} bus</span></div>${vehicles.map(v=>`<div class="fleet-card"><div class="vehicle-symbol">${ico('bus')}</div><div><strong>${esc(v.code)}</strong><p>${number(v.seats)} places · ${esc(getOperator(v.operatorId)?.name)}</p></div><span class="pill teal">Disponible</span></div>`).join('')}</section><section class="panel"><h3>Nouveau bus fictif</h3><form data-form="vehicle" class="stack-form"><label for="busCode">Code interne</label><input id="busCode" name="code" maxlength="16" minlength="2" required placeholder="Ex. LUB-045"><label for="busSeats">Nombre de places</label><input id="busSeats" name="seats" type="number" min="1" max="80" value="22" required><button type="submit" class="btn btn-primary">${ico('plus')} Ajouter un bus</button></form>${notice('subtle-notice','Démo locale','L’ajout ne crée pas de véhicule sur Render ou PostgreSQL.')}</section></div>`;}
function operatorAssignments(){const trips=visibleTrips(state,actor());return `${h('Affectations','Les chauffeurs doivent appartenir au même transporteur que la tournée.')}
 <section class="panel">${trips.map(t=>{const r=routeOf(state,t),options=state.drivers.filter(d=>d.operatorId===actor().operatorId&&d.active);return `<div class="assignment-row"><div><strong>${esc(r.name)}</strong><p>${esc(vehicleOf(state,t)?.code)} · ${esc(t.time)} → ${esc(t.eta)}</p>${tag(t.status)}</div><form data-form="assignment" class="inline-form"><input type="hidden" name="tripId" value="${esc(t.id)}"><label class="sr-only" for="assign-${esc(t.id)}">Chauffeur pour ${esc(r.name)}</label><select id="assign-${esc(t.id)}" name="driverId" ${t.status==='planned'?'':'disabled'}>${options.map(d=>`<option value="${esc(d.id)}" ${d.id===t.driverId?'selected':''}>${esc(d.ref)}</option>`).join('')}</select><button type="submit" class="btn btn-outline" ${t.status==='planned'?'':'disabled'}>Enregistrer</button></form></div>`}).join('')}</section>`;}
function operatorIncidents(){const incidents=visibleIncidents(state,actor());return `${h('Suivi des incidents','Clôturez les signalements fictifs liés à votre transporteur.')}
 <section class="panel">${incidents.length?incidents.map(i=>`<div class="incident-row"><span class="incident-icon">${ico('alert')}</span><div><strong>${esc(i.note)}</strong><p>${esc(routeOf(state,tripOf(state,i.tripId))?.name)} · ${i.level==='warning'?'À surveiller':'Information'}</p></div>${i.status==='open'?action('Clôturer','resolve',i.id,'outline'):'<span class="pill teal">Résolu</span>'}</div>`).join(''):'<div class="empty">Aucun incident enregistré dans ce périmètre.</div>'}</section>`;}
function driverOverview(){const t=visibleTrips(state,actor())[0];if(!t)return notice('warning-note','Aucune tournée','Aucune tournée affectée à ce chauffeur fictif.');return `${h('Ma tournée du matin','Parcours simulé, sans géolocalisation réelle.',`<span class="date-chip">${ico(state.driverOnline?'wifi':'offline')} ${state.driverOnline?'Connecté (simulation)':'Hors ligne (simulation)'}</span>`)}
 <div class="driver-hero"><div class="driver-hero-main"><span class="eyebrow light">Circuit attribué aujourd’hui</span><h2>${esc(routeOf(state,t).name)}</h2><p>${esc(vehicleOf(state,t)?.code)} · ${esc(t.time)} – ${esc(t.eta)} · ${esc(getSchool(routeOf(state,t).schoolId)?.name)}</p><div class="hero-controls">${t.status==='planned'?action(`${ico('arrow')} Démarrer la tournée`,'start',t.id,'white',!state.driverOnline):''}${t.status==='in_progress'?action('Étape suivante','advance',t.id,'white',t.progress>=100):''}${t.status==='in_progress'?action('Terminer','finish',t.id,'ghost'):''}${action(state.driverOnline?'Passer hors ligne':'Rétablir la connexion','connection','','ghost')}</div></div><div class="driver-hero-aside"><div class="round-meter"><strong>${t.progress}%</strong><span>parcouru (démo)</span></div></div></div>
 ${notice('subtle-notice','Simulation hors ligne',`Le suivi reste fictif. Lorsque le chauffeur passe hors ligne, les étapes sont mises en file (${state.outbox.length}) et le parent ne voit que la dernière progression publiée.`)}
 <div class="content-grid"><section class="panel">${progressTrack(t)}</section><section class="panel"><h3>Mon programme</h3><div class="detail-lines"><div><span>Statut</span>${tag(t.status)}</div><div><span>Références à prendre en charge</span><strong>${assignedStudents(t).length}</strong></div><div><span>Confirmations</span><strong>${t.boarded.length}</strong></div><div><span>Événements en attente</span><strong>${state.outbox.length}</strong></div></div><button data-nav="boarding" class="btn btn-outline fill">Voir la liste de prise en charge ${ico('arrow')}</button></section></div>`;}
function driverBoarding(){const t=visibleTrips(state,actor())[0];if(!t)return notice('warning-note','Aucune tournée','Aucune tournée visible.');const students=visibleStudents(state,actor()).filter(s=>s.tripId===t.id);return `${h('Prise en charge','Identifiants anonymes uniquement — aucune information nominative.')}
 <section class="panel"><div class="panel-head"><h3>${esc(routeOf(state,t).name)}</h3><span class="muted">${t.boarded.length}/${students.length} confirmés</span></div>${students.map(st=>`<div class="student-row"><div class="student-avatar">${ico('users')}</div><div><strong>${esc(st.ref)}</strong><p>${st.absence?'Absence déclarée (démo)':'Référence autorisée pour cette tournée'}</p></div>${t.boarded.includes(st.id)?'<span class="pill teal">Pris en charge</span>':st.absence?'<span class="pill warm">Absent</span>':action('Confirmer','board',st.id,'outline',t.status!=='in_progress')}</div>`).join('')}</section>`;}
function driverIncidents(){const t=visibleTrips(state,actor())[0];return `${h('Signaler un incident','Les informations restent uniquement dans votre navigateur.')}
 <div class="content-grid narrow-main"><section class="panel"><h3>Nouveau signalement</h3><form class="stack-form" data-form="incident"><label for="incidentType">Niveau</label><select id="incidentType" name="level"><option value="info">Information</option><option value="warning">À surveiller</option></select><label for="incidentNote">Description fictive</label><textarea id="incidentNote" name="note" rows="4" minlength="2" maxlength="180" required placeholder="Ex. Retard fictif dû à un embouteillage…"></textarea><button class="btn btn-primary" type="submit">${ico('alert')} Signaler (démo)</button></form></section><section class="panel"><h3>Signalements de ma tournée</h3>${t?visibleIncidents(state,actor()).filter(i=>i.tripId===t.id).map(i=>`<div class="incident-row"><span class="incident-icon">${ico('alert')}</span><div><strong>${esc(i.note)}</strong><p>${i.status==='open'?'Ouvert':'Résolu'}</p></div></div>`).join('')||'<p class="muted">Aucun incident.</p>':'<p>Aucune tournée.</p>'}</section></div>`;}
function parentOverview(){const trips=visibleTrips(state,actor());const t=trips[0];if(!t)return notice('warning-note','Pas de suivi','Aucun trajet rattaché à une référence vérifiée de ce profil.');const r=routeOf(state,t);return `${h('Suivi de mon bus','Uniquement les trajets associés à votre référence vérifiée.',`<span class="date-chip">${ico('shield')} Accès limité au responsable</span>`)}
 <div class="parent-hero"><div class="eyebrow light">Navette scolaire · suivi fictif</div><h2>${esc(r.name)}</h2><p>${esc(getSchool(r.schoolId)?.name)} · Départ ${esc(t.time)} · Arrivée estimée ${esc(t.eta)}</p><div class="parent-hero-footer">${tag(t.status)}<span>${ico('clock')} Dernière étape publiée : ${t.publishedProgress}%</span></div></div>
 <div class="content-grid"><section class="panel">${progressTrack(t)}${notice('subtle-notice','Information importante','Cette carte est une frise de parcours simulée. Elle ne représente pas une localisation GPS et aucune position d’enfant n’est collectée.')}</section><section class="panel"><h3>Référence(s) suivie(s)</h3>${visibleStudents(state,actor()).map(st=>`<div class="student-row"><span class="student-avatar">${ico('users')}</span><div><strong>${esc(st.ref)}</strong><p>${esc(getSchool(st.schoolId)?.name)}</p></div><span class="pill teal">Vérifiée (démo)</span></div>`).join('')}<button class="btn btn-outline fill" data-nav="children">Gérer les absences fictives ${ico('arrow')}</button></section></div>`;}
function parentChildren(){const students=visibleStudents(state,actor());return `${h('Mes références suivies','Uniquement les références rattachées au responsable fictif de ce profil.')}
 <section class="panel">${students.map(st=>{const t=tripOf(state,st.tripId);return `<div class="student-row"><span class="student-avatar">${ico('users')}</span><div><strong>${esc(st.ref)}</strong><p>${esc(routeOf(state,t)?.name)} · ${esc(t?.time)} · ${st.absence?'Absence annoncée':'Présence attendue'}</p></div>${action(st.absence?'Annuler absence':'Signaler absence','absence',st.id,st.absence?'primary':'outline',t?.status!=='planned')}</div>`}).join('')}</section>${notice('info-note','Confidentialité','Les références de l’autre école et des autres parents sont volontairement masquées.')}`;}
function parentNotifications(){const notifications=visibleNotifications(state,actor());return `${h('Mes notifications','Alertes de démonstration, non envoyées par SMS ni push.',action('Marquer comme lues','read','','outline'))}
 <div class="content-grid narrow-main"><section class="panel"><h3>Événements de la session</h3>${notifications.length?notifications.map(n=>`<div class="notification-row ${n.read?'read':''}"><span class="notification-icon">${ico('bell')}</span><div><strong>${esc(n.text)}</strong><p>${esc(routeOf(state,tripOf(state,n.tripId))?.name)} · Simulation</p></div>${n.read?'':'<span class="unread-dot"></span>'}</div>`).join(''):'<div class="empty">Aucune nouvelle alerte. Démarrez une tournée depuis le profil Chauffeur pour simuler une notification.</div>'}</section><section class="panel"><h3>Préférences (locales)</h3><p class="muted">Prévisualisation de l’option d’alertes. Aucun SMS ni push réel n'est envoyé.</p><button class="toggle-row" data-action="alerts" aria-pressed="${state.alertsEnabled}"><span>Recevoir les alertes fictives</span><span class="toggle ${state.alertsEnabled?'on':''}"></span></button><div class="info-note">${ico('info')}<div><strong>Mode démonstration</strong><p>Les notifications sont locales à cette session. Pour la production, consentement et révocation restent obligatoires.</p></div></div></section></div>`;}
function contextPanel(){const labels={admin:'Gestion scolaire',operator:'Exploitation de la flotte',driver:'Application chauffeur',parent:'Espace famille'};return `<aside class="context-sidebar"><div class="context-card"><span class="eyebrow">Votre espace</span><h3>${labels[role]}</h3><div class="context-icon">${ico(role==='operator'?'bus':role==='driver'?'route':role==='parent'?'users':'building')}</div><p>${role==='admin'?'Un établissement fictif, des élèves anonymisés et ses seules tournées.':role==='operator'?'Une flotte et des conducteurs rattachés à un seul transporteur.':role==='driver'?'Une seule tournée attribuée, avec reprise de connexion simulée.':'Une référence parent–enfant vérifiée et un seul circuit visible.'}</p></div><div class="context-privacy">${ico('shield')}<div><strong>Données fictives</strong><p>Aucune donnée d’élève réel, aucun GPS ni paiement ne sont transmis.</p></div></div></aside>`;}
function bodyContent(){
 const map={admin:{overview:adminOverview,students:adminStudents,routes:adminRoutes,partners:adminPartners},operator:{overview:operatorOverview,fleet:operatorFleet,assignments:operatorAssignments,incidents:operatorIncidents},driver:{overview:driverOverview,boarding:driverBoarding,incidents:driverIncidents},parent:{overview:parentOverview,children:parentChildren,notifications:parentNotifications}};
 return (map[role][view]||map[role].overview)();
}
function draw(){
 const tabs=nav[role]; const selected=tabs.find(([id])=>id===view)||tabs[0];
 root.innerHTML=`<div class="app-shell">
 <aside class="sidebar ${mobileNavOpen?'sidebar-visible':''}"><div class="brand"><span class="brand-icon">${ico('bus')}</span><div><strong>BUS<span>SCOLAIRE</span></strong><small>ESPACE V3 · DÉMO</small></div></div>
 <div class="workspace-label">ESPACE DE TRAVAIL</div><div class="workspace-box"><span class="workspace-avatar">${role==='admin'?'EH':role==='operator'?'TK':role==='driver'?'CA':'PA'}</span><div><strong>${esc(actor().title)}</strong><small>${role==='operator'?'Transport Kivu (fictif)':role==='driver'?'Chauffeur A (fictif)':role==='parent'?'Responsable A (fictif)':'École Horizon (fictive)'}</small></div>${ico('chevron')}</div>
 <nav class="sidebar-nav" aria-label="Navigation principale"><div class="nav-label">MENU PRINCIPAL</div>${tabs.map(([id,label,iconName])=>`<button class="nav-item ${view===id?'active':''}" data-nav="${id}" ${view===id?'aria-current="page"':''}>${ico(iconName)}<span>${label}</span>${view===id?'<span class="active-indicator"></span>':''}</button>`).join('')}</nav>
 <div class="sidebar-bottom"><div class="sidebar-status"><span class="live-dot"></span><div><strong>Mode démonstration</strong><small>Aucune donnée réelle</small></div></div><div class="sidebar-caption">Prototype indépendant de Render et de la V2.</div></div></aside>
 <div class="main-column"><header class="topbar"><button class="mobile-menu" aria-label="Ouvrir le menu" data-action="menu">${ico('menu')}</button><div class="breadcrumbs"><span>Bus scolaire V3</span><span class="crumb">/</span><strong>${esc(selected[1])}</strong></div><div class="topbar-right"><span class="demo-indicator"><span></span> Données fictives</span><button class="icon-btn" data-action="reset" title="Réinitialiser les données de démonstration" aria-label="Réinitialiser">${ico('reset')}</button><div class="mini-profile">${role==='admin'?'EH':role==='operator'?'TK':role==='driver'?'CA':'PA'}</div></div></header>
 <div class="role-switch"><div><span class="role-switch-label">Explorer les interfaces</span><p>Choisis un profil simulé pour tester ses parcours.</p></div><div class="role-options" role="group" aria-label="Choisir un profil">${Object.entries(accounts).map(([key,a])=>`<button data-role="${key}" class="role-option ${role===key?'selected':''}" aria-pressed="${role===key}">${esc(a.title)}</button>`).join('')}</div></div>
 <main class="main-content"><div class="page-area">${bodyContent()}</div>${contextPanel()}</main>
 <footer class="footer"><span>Bus scolaire V3 · Lot 6</span><span>Scénario Lubumbashi (RDC) · Aucun accès à une API réelle</span></footer></div></div>
 ${toast?`<div class="toast" role="status">${ico('info')} ${esc(toast)} <button data-action="dismiss" aria-label="Fermer le message">×</button></div>`:''}`;
}
function update(fn,success){try{state=fn(state);toast=success;draw();}catch(e){toast=e.message||'Action impossible';draw();}}
root.addEventListener('click',e=>{
 const target=e.target.closest('button');if(!target)return;
 if(target.dataset.role){role=target.dataset.role;view='overview';toast='Profil simulé changé : ce n’est pas une connexion réelle.';mobileNavOpen=false;draw();return;}
 if(target.dataset.nav){view=target.dataset.nav;mobileNavOpen=false;toast='';draw();return;}
 const a=target.dataset.action,id=target.dataset.id;
 if(!a)return;
 if(a==='menu'){mobileNavOpen=!mobileNavOpen;draw();return;}
 if(a==='dismiss'){toast='';draw();return;}
 if(a==='reset'){state=makeState();role='admin';view='overview';toast='Scénario fictif réinitialisé.';draw();return;}
 const me=actor();
 if(a==='start')update(s=>startTrip(s,me,id),'Départ simulé enregistré.');
 if(a==='advance')update(s=>advanceTrip(s,me,id),'Étape enregistrée. Consulte le profil Parent pour voir le dernier état publié.');
 if(a==='finish')update(s=>finishTrip(s,me,id),'Tournée terminée (simulation).');
 if(a==='connection')update(s=>setDriverOnline(s,me,!s.driverOnline),state.driverOnline?'Mode hors ligne fictif activé.':'File locale synchronisée.');
 if(a==='board')update(s=>boardStudent(s,me,visibleTrips(s,me)[0]?.id,id),'Prise en charge fictive confirmée.');
 if(a==='resolve')update(s=>resolveIncident(s,me,id),'Incident marqué comme résolu.');
 if(a==='absence')update(s=>toggleAbsence(s,me,id),'Déclaration fictive mise à jour.');
 if(a==='alerts')update(s=>toggleAlerts(s,me),'Préférence fictive mise à jour.');
 if(a==='read')update(s=>readNotifications(s,me),'Notifications marquées comme lues.');
});
root.addEventListener('submit',e=>{
 const form=e.target.closest('form[data-form]');if(!form)return;
 e.preventDefault();
 const data=new FormData(form),me=actor();
 if(form.dataset.form==='student')update(s=>addStudent(s,me,data.get('ref')),'Référence fictive ajoutée.');
 if(form.dataset.form==='vehicle')update(s=>addVehicle(s,me,data.get('code'),data.get('seats')),'Véhicule fictif ajouté.');
 if(form.dataset.form==='assignment')update(s=>assignDriver(s,me,data.get('tripId'),data.get('driverId')),'Chauffeur affecté (démo).');
 if(form.dataset.form==='incident')update(s=>reportIncident(s,me,visibleTrips(s,me)[0]?.id,data.get('note'),data.get('level')),'Signalement fictif enregistré.');
});
draw();
