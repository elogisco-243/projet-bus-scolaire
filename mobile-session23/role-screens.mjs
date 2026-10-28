/** UI-193 — Parent / Superviseur demo UI. Never authenticate via a URL parameter.
 * Preserves existing Chauffeur / Accompagnateur assets unchanged.
 */
import {createFourRoleDemo} from '../mobile-session19/four-role-demo-workflow.mjs';
import {parentDemoDashboard,supervisorDemoDashboard} from '../mobile-session19/parent-supervisor-demo-dashboard.mjs';
const root=document.getElementById('app');
let snapshot=createFourRoleDemo();
let profile=null,tab='tour',childId='A-01',message='';
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const buttons=[['tour','◉','Ma tournée'],['alerts','⚠','Alertes'],['team','♧','Équipe'],['more','⋯','Plus']];
function demoSeed(){ // synthetic data, never claimed as live tracking
 const s=createFourRoleDemo();s.status='in_progress';s.revision=2;
 s.stops[0].reached=true;s.currentStopId=s.stops[0].id;
 s.students[0].boarded=true;
 s.notifications=[{id:'DEMO-NT-01',studentId:'A-01',action:'board',status:'unread'}];
 return s;
}
snapshot=demoSeed();
function choose(){
 root.innerHTML='<div class="shell"><header class="head"><div class="brand">A2S Scola</div><div class="role">Choisir une session de démonstration</div><span class="demo">DÉMO UNIQUEMENT</span></header><main class="main"><div class="hero"><small>Bus LUB-014</small><h1>Circuit Golf</h1><strong>Dépôt · Golf · Centre · École Horizon</strong></div><h2 class="section">Accès au prototype</h2><button class="primary" data-role="parent">Profil Parent — suivre mon enfant</button><button class="primary" data-role="supervisor">Profil Superviseur — surveiller les tournées</button><p class="muted">Aucun identifiant réel n’est vérifié ici. Aucun suivi GPS, notification ou commande opérationnelle n’est activé.</p></main></div>';
}
function section(title,content){return '<h2 class="section">'+title+'</h2>'+content;}
function tile(title,description='',extra=''){return '<article class="tile"><div class="row"><strong>'+safe(title)+'</strong>'+extra+'</div><p>'+safe(description)+'</p></article>';}
function route(steps,reached){return '<div class="steps">'+steps.map((stop,i)=>'<div class="step"><span class="dot '+(i<reached?'done':'')+'">'+(i+1)+'</span><strong>'+safe(stop)+'</strong></div>').join('')+'</div>';}
function render(){
 if(!profile){choose();return;}
 const parent=profile==='parent';
 const data=parent?parentDemoDashboard(snapshot,{pupilIds:[childId]}):supervisorDemoDashboard(snapshot);
 if(!data.ok){root.textContent='Données de démonstration indisponibles : '+data.code;return;}
 const status=data.status==='completed'?'Terminée':data.status==='in_progress'?'En cours':'À préparer';
 let body='';
 if(tab==='tour'){
  body='<div class="hero"><small>BUS '+safe(data.busId)+' · '+safe(data.routeName)+'</small><h1>'+safe(status)+'</h1><strong>Prochain arrêt : '+safe(data.nextStop)+'</strong></div>';
  body+='<div class="stats"><div class="stat"><b>'+data.stopsReached+'/'+data.stopsTotal+'</b><span>Arrêts atteints</span></div>'+
   (parent?'<div class="stat"><b>'+safe(data.pupils[0]?.state??'—')+'</b><span>État de mon enfant</span></div>':
   '<div class="stat"><b>'+data.onboard+'</b><span>Élèves à bord</span></div><div class="stat"><b>'+data.assigned+'</b><span>Élèves affectés</span></div>')+'</div>';
  body+=parent?section('Mon enfant',tile('Élève fictif '+childId, data.pupils[0]?.state??'Aucune donnée autorisée dans cette démonstration')):
   section('Situation générale',tile('Tournée Golf','Une seule tournée fictive consultable dans ce prototype'));
  body+=section('Parcours',route(data.routeStops,data.stopsReached));
 }else if(tab==='alerts'){
  if(parent)body=section('Notifications de mon enfant',data.notifications.length?
    data.notifications.map(n=>tile('Élève '+n.studentId,n.type==='board'?'Montée enregistrée en simulation':n.type==='alight'?'Descente enregistrée en simulation':n.type==='mark_absent'?'Absence déclarée':'Événement de simulation','<span class="pill">'+(n.read?'Lu':'Nouveau')+'</span>')).join(''):
    tile('Aucune notification','Les notifications réelles ne sont pas disponibles.'));
  else body=section('Incidents',data.incidents.length?
    data.incidents.map(i=>tile(i.kind,'Référence '+i.id+' — '+i.status)).join(''):
    tile('Aucun incident ouvert','Aucun signalement dans cette simulation.'));
 }else if(tab==='team'){
  body=parent?section('Mon accompagnement',tile('Transport scolaire','Pour une urgence réelle, contactez directement le service de transport par ses canaux officiels. Aucune messagerie n’est active dans cette démo.')):
  section('Équipe de transport',tile('Chauffeur','Responsable de la conduite et de la sécurisation du véhicule')+tile('Accompagnateur','Responsable du pointage et de la sécurité des élèves')+tile('Superviseur','Responsable de la revue des incidents et tournées'));
 }else {
  body=section('À propos',tile('Version de démonstration','Circuit fictif Golf · Bus LUB-014'))+
    tile('Protection des données','Les affectations parent–enfant réelles doivent être vérifiées par un serveur.')+
    tile('Mode opérationnel','Non disponible dans cette version.');
 }
 root.innerHTML='<div class="shell"><header class="head"><div class="headtop"><div><div class="brand">A2S Scola</div><div class="role">'+(parent?'Parent':'Superviseur')+'</div><span class="demo">DÉMO</span></div><button class="return" data-action="exit" aria-label="Changer de session">Quitter</button></div></header><main class="main">'+(message?'<p class="attention">'+safe(message)+'</p>':'')+body+'<p class="muted">Données locales fictives · Aucun suivi GPS ni synchronisation avec un autre téléphone.</p></main><nav class="tabs" aria-label="Navigation principale">'+buttons.map(([id,ico,label])=>'<button class="tab '+(tab===id?'active':'')+'" data-tab="'+id+'" aria-current="'+(tab===id?'page':'false')+'"><span class="ico" aria-hidden="true">'+ico+'</span>'+label+'</button>').join('')+'</nav></div>';
}
root.addEventListener('click',e=>{
 const btn=e.target.closest('button');if(!btn)return;
 if(btn.dataset.role){profile=btn.dataset.role;tab='tour';message='';render();return;}
 if(btn.dataset.action==='exit'){profile=null;tab='tour';message='';render();return;}
 if(btn.dataset.tab){tab=btn.dataset.tab;message='';render();}
});
render();
