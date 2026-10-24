import {makeAttendantDemo,runAttendantDemo,attendantSummary} from './attendant-demo.mjs';
let state=makeAttendantDemo(),tab='tour',message='',showTourDetails=false;
const root=document.querySelector('#app');
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(label,action,arg='',kind='light',disabled=false)=>`<button class="${kind}" data-action="${action}" data-arg="${escapeHTML(arg)}" ${disabled?'disabled':''}>${label}</button>`;
function content(){const d=attendantSummary(state),started=d.status==='in_progress',done=d.status==='completed';
if(tab==='tour')return `<section class="tour-dashboard" aria-label="Tableau de bord Accompagnateur">
<section class="card tour-hero">
  <div class="tour-heading"><h2>MA TOURNÉE</h2><div class="tour-heading-right"><span class="trip-state">${started?'● EN COURS':done?'✓ TERMINÉE':'○ À PRÉPARER'}</span><span class="network-icon" title="Réseau simulé uniquement" aria-label="Réseau simulé">⌁</span></div></div>
  <div class="next-stop"><div><span class="hero-label">⌖&nbsp; PROCHAIN ARRÊT</span><strong>Arrêt fictif A</strong></div><span class="sound-icon" title="Annonces vocales non disponibles dans ce simulateur" aria-label="Annonces vocales non disponibles">◖</span></div>
  <div class="hero-stats"><div><span class="hero-label">♧&nbsp; ENFANTS À BORD</span><strong>${d.onboard} / ${d.assigned}</strong></div><div><span class="hero-label">⌖&nbsp; ARRÊTS ATTEINTS</span><strong>— / —</strong></div></div>
  <div class="hero-info">
    <div><span class="hero-symbol" aria-hidden="true">▣</span><div><strong>Bus BUS-DÉMO-01</strong><small>Circuit fictif A</small></div></div>
    <div><span class="hero-symbol" aria-hidden="true">♧</span><div><strong>Équipe affectée</strong><small>Accompagnateur ${d.presence?'présent':'à confirmer'} · Chauffeur fictif</small></div></div>
    <div><span class="hero-symbol" aria-hidden="true">⬡</span><div><strong>Bus immobilisé et sécurisé</strong><small>Validation physique du Chauffeur requise — non simulée</small></div><span class="read-only-indicator" aria-label="Non confirmé"></span></div>
  </div>
</section>
<div class="dashboard-actions" aria-label="Actions rapides">
${button('☑<span>POINTAGE DES ENFANTS</span>','go_boarding','','primary dash-action')}
${button('✓<span>VALIDATION CROISÉE</span>','go_team','','light dash-action')}
${button('⚠<span>SIGNALER UN INCIDENT</span>','go_alerts','','warn dash-action')}
${button('⌖<span>SUIVI DE TOURNÉE</span>','go_tour_details','','light dash-action')}
</div>
${showTourDetails?`<section class="card tour-details" role="status"><h2>Suivi de tournée — démo</h2><div class="line"><span>Statut fictif</span><strong>${escapeHTML(d.status)}</strong></div><div class="line"><span>Connexion simulée</span><strong>${escapeHTML(d.network)}</strong></div><p class="hint">Aucune position GPS ni validation du Chauffeur n'est reçue dans ce test.</p></section>`:''}
<section class="card tour-controls"><h2>Simulation locale</h2><p class="hint">Aucune donnée réelle transmise. La validation croisée entre deux comptes n'est pas encore activée.</p>${button('Lancer la tournée simulée','start_demo_trip','','primary full',!d.presence||started||done)}${button('Simuler coupure / retour réseau','network','','light full')}</section>
</section>`;
if(tab==='boarding')return `<section class="card"><h2>Pointage des enfants</h2><p class="hint">Références fictives, sans noms ni données personnelles.</p>${state.students.map(s=>`<div class="line"><div><strong>${escapeHTML(s.id)}</strong><div class="status">${s.alighted?'Descendu':s.boarded?'À bord':'En attente'}</div></div><div class="buttons">${button('Monter','board',s.id,'light',!started||s.boarded)}${button('Descendre','alight',s.id,'warn',!started||!s.boarded||s.alighted)}</div></div>`).join('')}</section><section class="card"><h2>Contrôle final</h2><p class="hint">Confirmer le véhicule vide uniquement après vérification physique des places.</p>${button('Confirmer véhicule vide','confirm_empty','','light full',!started||d.onboard>0||state.events.some(x=>x.type==='empty_bus_confirmed'))}${button('Terminer la simulation','finish_demo_trip','','primary full',!started||d.onboard>0||!state.events.some(x=>x.type==='empty_bus_confirmed'))}</section>`;
if(tab==='alerts')return `<section class="card"><h2>Signaler un incident fictif</h2><div class="buttons">${[['Retard','delay'],['Panne','breakdown'],['Accident','accident'],['Urgence médicale','medical'],['Enfant manquant','missing_child'],['Autre','other']].map(([n,a])=>button(n,'incident',a,a==='accident'||a==='medical'||a==='missing_child'?'danger':'light',!started)).join('')}</div><p class="hint">Aucune alerte n'est envoyée à des tiers.</p></section><section class="card"><h2>Journal de simulation</h2>${state.events.slice().reverse().map(x=>`<div class="line"><span>${escapeHTML(x.type)}</span><small>Local uniquement</small></div>`).join('')||'<p class="hint">Aucun événement.</p>'}</section>`;
return `<section class="card"><h2>Équipe affectée (fictive)</h2><div class="line"><span>Chauffeur</span><strong>CHAUFFEUR-DÉMO</strong></div><div class="line"><span>Accompagnateur</span><strong>ATT-DEMO</strong></div><div class="line"><span>Présence</span><strong>${d.presence?'Confirmée':'À confirmer'}</strong></div>${button('Confirmer ma présence','confirm_presence','','primary full',d.presence||done)}</section><section class="card"><h2>Session</h2><div class="line"><span>Environnement</span><strong>DÉMO</strong></div><p class="hint">Pas de synchronisation distante, même lorsque le réseau simulé est connecté.</p>${button('Réinitialiser la simulation','reset','','light full')}</section>`;
}
function render(){
 root.innerHTML=`<div class="app"><header class="head">
   <div class="brand"><div class="brand-left"><span class="brand-mark" role="img" aria-label="Logo officiel A2S Scola">▣</span><div><div class="brand-name">A2S Scola</div><div class="brand-sub">Profil Accompagnateur</div></div></div><span class="settings-symbol" title="Réglages indisponibles dans cette démonstration" aria-hidden="true">⚙</span></div>
   <div class="demo-pill" aria-label="Environnement démonstration, sans serveur réel">DÉMO · Sans serveur réel</div>
 </header>
 <main class="content" aria-label="${({tour:'Ma tournée',boarding:'Pointage',alerts:'Alertes',team:'Équipe'})[tab]}">
 ${tab!=='tour'?`<h1 class="page-title">${({boarding:'Pointage',alerts:'Alertes',team:'Équipe'})[tab]}</h1>`:''}
 ${message?`<div class="error" role="status">${escapeHTML(message)}</div>`:''}
 ${content()}
 </main>
 <nav class="bottom" aria-label="Menus accompagnateur">${[['tour','▣','Ma tournée'],['alerts','⚠','Alertes'],['boarding','☑','Pointage'],['team','♧','Équipe']].map(([id,icon,label])=>`<button type="button" data-tab="${id}" class="${tab===id?'active':''}" ${tab===id?'aria-current="page"':''}><span class="nav-icon" aria-hidden="true">${icon}</span><span class="nav-label">${label}</span></button>`).join('')}</nav>
 </div>`;
}
root.addEventListener('click',e=>{const target=e.target.closest('button');if(!target)return;message='';if(target.dataset.tab){tab=target.dataset.tab;render();return}let action=target.dataset.action;if(!action)return;try{if(action==='go_boarding'||action==='go_alerts'||action==='go_team'||action==='go_tour_details'){tab=action==='go_boarding'?'boarding':action==='go_alerts'?'alerts':action==='go_team'?'team':'tour';if(action==='go_tour_details')showTourDetails=!showTourDetails;if(action==='go_team')message='Validation croisée réelle non disponible : équipe fictive seulement.';}else if(action==='reset'){state=makeAttendantDemo();tab='tour'}else if(action==='network')state=runAttendantDemo(state,state.network==='simulated-online'?'simulate_network_loss':'simulate_network_return');else state=runAttendantDemo(state,action==='incident'?'report_incident':action,action==='incident'?{incident:target.dataset.arg}:{studentId:target.dataset.arg});}catch(err){message='Action refusée : '+err.message}render()});render();
