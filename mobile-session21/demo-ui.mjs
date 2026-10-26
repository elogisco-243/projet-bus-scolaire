// UI-168 browser demo: distinct role tabs, one local HTTP trip. Not operational.
const root=document.getElementById('content');
let token=null,profile=null,snapshot=null,connected=false,busy=false,pollHandle=null,notice='';
const titles={chauffeur:'Chauffeur',accompagnateur:'Accompagnateur',parent:'Parent · E-01',
 parent2:'Parent · E-02',superviseur:'Superviseur'};
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const btn=(label,type,payload={},kind='action',disabled=false)=>'<button type="button" class="'+kind+'" data-type="'+esc(type)+'" data-payload="'+esc(JSON.stringify(payload))+'" '+(disabled?'disabled':'')+'>'+esc(label)+'</button>';
const stopName=id=>id?({'STOP-01':'Dépôt','STOP-02':'Arrêt fictif A','STOP-03':'Terminus fictif B'}[id]||id):'Avant départ';
const statusLabel=s=>s==='in_progress'?'En cours':s==='completed'?'Clôturée':'Planifiée';
const requestLabel=s=>({pending:'En attente',approved_demo:'Approuvée (démo)',rejected_demo:'Refusée (démo)',cancelled:'Annulée'}[s]||s);
const summary=s=>'<div class="metric-grid">'+
 '<div class="metric"><strong>'+esc(statusLabel(s.status))+'</strong><span>État de tournée</span></div>'+
 '<div class="metric"><strong>'+esc(stopName(s.stopId))+'</strong><span>Dernier arrêt atteint</span></div>'+
 '<div class="metric"><strong>'+s.pendingAtStop+'</strong><span>Pointages restants à cet arrêt</span></div>'+
 '<div class="metric"><strong>'+s.revision+'</strong><span>Révision partagée</span></div></div>';
const item=(name,help,actions='')=>'<div class="item"><div><strong>'+esc(name)+'</strong><div class="help">'+esc(help)+'</div></div><div class="actions">'+actions+'</div></div>';
function actorBody(s){
 if(profile==='parent'||profile==='parent2'){
  const people=(s.children||[]).map(p=>item('Élève '+p.studentId,
    'Destination : '+stopName(p.dropoffStopId)+' · '+(p.released?'Remise déclarée (démo)':p.absent?'Absence annoncée':p.boarded?'À bord (démo)':'Non monté'),
    (!p.absent&&!p.boarded&&!p.pickupAlreadyPassed&&s.status!=='completed')?
      btn('Signaler absent (démo)','notify_absence',{studentId:p.studentId,reason:'family_notified'},'action secondary'):'')).join('');
  const requests=(s.requests||[]).map(r=>item('Demande '+r.id,
    stopName(r.fromStopId)+' → '+stopName(r.toStopId)+' · '+requestLabel(r.status)+(r.reason?' · Motif : '+r.reason:''),
    r.status==='pending'?btn('Annuler (démo)','cancel_change',{requestId:r.id},'action secondary'):'')).join('');
  const child=s.children?.[0],parentId=profile==='parent'?'PA-DEMO':'PB-DEMO';
  const destinations=['STOP-01','STOP-02','STOP-03'].filter(id=>id!==child?.dropoffStopId);
  return '<section class="card"><h2>Mes enfants fictifs</h2><div class="list">'+(people||'<p>Aucun élève</p>')+'</div></section>'+
   '<section class="card"><h2>Demander un changement d’arrêt</h2>'+
   '<p class="notice">Une demande reste en attente. Seule la décision séparée du Superviseur peut modifier le trajet fictif.</p>'+
   (child?'<form id="stop-request"><label for="newstop">Nouvel arrêt</label><select id="newstop" name="stop">'+
    destinations.map(id=>'<option value="'+esc(id)+'">'+esc(stopName(id))+'</option>').join('')+
    '</select><button class="action" type="submit" '+(s.status!=='in_progress'||child.absent||child.released?'disabled':'')+'>Envoyer la demande (démo)</button></form>'+
    '<p class="muted">Destinataire simulé : '+esc(parentId)+'. Aucune demande n’est transmise à un établissement.</p>':'')+
   '</section><section class="card"><h2>Mes demandes</h2><div class="list">'+(requests||'<p>Aucune demande</p>')+'</div></section>';
 }
 if(profile==='superviseur'){
  const requests=(s.requests||[]).map(r=>item('Élève '+r.studentId+' · '+requestLabel(r.status),
   stopName(r.fromStopId)+' → '+stopName(r.toStopId)+' · demande de '+r.parentId,
   r.status==='pending'?
    (r.proposedRevision!==s.revision?
      btn('Réexaminer (démo)','revalidate_change_demo',{requestId:r.id},'action secondary'):
      btn('Approuver (démo)','review_change_demo',{requestId:r.id,demoPolicyApproved:true}))+
    btn('Refuser (démo)','reject_change_demo',{requestId:r.id,reason:'policy_refused'},'action danger'):'')).join('');
  const alerts=(s.alerts||[]).map(a=>item(a.kind,a.open?'Critique ouverte':'Traitée en simulation',
   a.open?btn('Traiter (démo)','resolve_critical_demo',{incidentId:a.id,demoResolutionConfirmed:true}):'')).join('');
  const reviews=(s.students||[]).filter(p=>p.boarded&&!p.released&&p.dropoffStopId===s.stopId&&s.parked).map(p=>{
   const reviewed=(s.handovers||[]).some(x=>x.studentId===p.studentId&&x.status==='reviewed_demo');
   return item('Remise de '+p.studentId,'Destinataire fictif : '+p.recipientId+
    (reviewed?' · Revue simulée enregistrée':' · Contrôles fictifs requis'),
    reviewed?'':btn('Revue simulée','review_handover_demo',
      {studentId:p.studentId,recipientId:p.recipientId,demoRecipientAndPersonChecked:true}));
  }).join('');
  return '<section class="card"><h2>Demandes Parent</h2><div class="list">'+(requests||'<p>Pas de demande</p>')+'</div></section>'+
   '<section class="card"><h2>Incidents critiques</h2><div class="list">'+(alerts||'<p>Aucune alerte ouverte</p>')+'</div></section>'+
   '<section class="card"><h2>Revue de remise (simulée)</h2><p class="notice important">Cette revue ne vérifie ni personne réelle ni badge réel.</p>'+
   '<div class="list">'+(reviews||'<p>Aucun élève à remettre à cet arrêt</p>')+'</div></section>'+
   '<section class="card"><h2>Réinitialisation du banc de test</h2>'+btn('Recommencer la tournée fictive','reset','{}','action danger')+'</section>';
 }
 if(profile==='chauffeur'){
  let next=s.status==='in_progress'&&!s.parked?s.stops[s.stops.indexOf(s.stopId)+1]||s.stops[0]:null;
  const acts=s.status==='planned'?
   btn('Démarrer la tournée (démo)','start',{},'action',!s.attendantReady):
   s.status==='in_progress'?
    (next?btn('Arrêt atteint : '+stopName(next),'arrive',{stopId:next}):'')+
    (s.parked&&s.stopId!=='STOP-03'?
      btn('Reprendre la course (démo)','resume',{},'action',!s.stopClearance):'')+
    (s.parked&&s.stopId==='STOP-03'?
      btn('Clôturer après inspection (démo)','finish',{demoInspectionAcknowledged:true},'action',!s.stopClearance):'')+
    btn('Signaler enfant manquant (démo)','report_critical',{kind:'missing_child'},'action danger'):'';
  return '<section class="card"><h2>Commandes du Chauffeur</h2>'+
   '<p class="notice">Préparation Accompagnateur : '+(s.attendantReady?'Confirmée':'En attente')+
   ' · Feu vert arrêt : '+(s.stopClearance?'Confirmé':'En attente')+'</p>'+
   '<div class="actions">'+acts+'</div></section>'+
   '<section class="card"><h2>Élèves à bord (démo)</h2><div class="list">'+
    ((s.onboard||[]).map(id=>item(id,'Enregistré à bord')).join('')||'<p>Bus déclaré vide</p>')+'</div></section>';
 }
 // Attendant
 const tasks=(s.students||[]).filter(p=>s.parked&&p.pickupStopId===s.stopId&&!p.boarded&&!p.absent||
  s.parked&&p.dropoffStopId===s.stopId&&p.boarded&&!p.released);
 const taskRows=tasks.map(p=>{
  if(p.boarded)return item('Descente · '+p.studentId,'Destinataire fictif : '+p.recipientId+
   ' · revue de remise par Superviseur obligatoire',
   btn('Remise confirmée (démo)','handover_demo',
    {studentId:p.studentId,recipientId:p.recipientId,demoPhysicalHandoverConfirmed:true}));
  return item('Montée · '+p.studentId,'À enregistrer à '+stopName(s.stopId),
   btn('Monté','board',{studentId:p.studentId})+
   btn('Non présenté','absent',{studentId:p.studentId,reason:'not_present'},'action secondary'));
 }).join('');
 return '<section class="card"><h2>Accompagnateur</h2><div class="actions">'+
 (s.status==='planned'?btn('Confirmer la préparation (démo)','ready',{},'action',s.attendantReady):'')+
 (s.parked&&s.status==='in_progress'?btn('Arrêt prêt à quitter (démo)','clear_stop',{},'action',s.pendingAtStop>0||s.criticalAlerts>0||s.stopClearance):'')+
 btn('Signaler enfant manquant (démo)','report_critical',{kind:'missing_child'},'action danger',s.status!=='in_progress')+
 '</div></section><section class="card"><h2>Pointage de l’arrêt</h2>'+
 '<div class="list">'+(taskRows||'<p>Aucun pointage restant</p>')+'</div></section>';
}
function redraw(){
 if(!token||!snapshot)return;
 const s=snapshot;
 const y=window.scrollY;
 root.innerHTML='<section class="card"><div class="role-top"><div><h1>Session '+esc(titles[profile])+'</h1>'+
  '<span class="tag">Simulation partagée</span></div><span class="status">'+
  (connected?'● Connecté au serveur local':'● Connexion perdue')+'</span></div>'+
  '<p class="muted">Tous les profils consultent la même tournée fictive. Identités non authentifiées.</p>'+
  summary(s)+'</section>'+
  (notice?'<div class="'+(notice.startsWith('Erreur')?'error':'success')+'" role="status">'+esc(notice)+'</div>':'')+
  (!connected?'<div class="error">Serveur local inaccessible. Actions suspendues.</div>':'')+
  actorBody(s);
 window.scrollTo(0,y);
}
async function api(path,options={}){
 const res=await fetch(path,{...options,headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{}),...options.headers},cache:'no-store'});
 let data;
 try{data=await res.json();}catch{throw Error('RÉPONSE_SERVEUR_ILLISIBLE');}
 if(!res.ok)throw Error(data.error||'HTTP_'+res.status);
 return data;
}
async function refresh(){
 if(!token||busy)return;
 try{
  const {snapshot:next}=await api('/api/state');
  const changed=!snapshot||next.revision!==snapshot.revision||!connected;
  snapshot=next;connected=true;
  if(changed)redraw();
 }catch(e){
  if(connected){connected=false;notice='Erreur de synchronisation : '+e.message;redraw();}
 }
}
async function join(profileName){
 if(busy)return;busy=true;
 try{
  const data=await api('/api/join',{method:'POST',body:JSON.stringify({profile:profileName})});
  profile=profileName;token=data.token;connected=true;notice='';
  await refresh();
  if(pollHandle!==null)clearInterval(pollHandle);
  pollHandle=setInterval(()=>{void refresh()},950);
 }catch(e){notice='Erreur : '+e.message;root.insertAdjacentHTML('afterbegin','<div class="error">'+esc(notice)+'</div>');}
 finally{busy=false;await refresh();}
}
async function command(type,payload={}){
 if(!token||!snapshot||!connected||busy)return;
 busy=true;notice='';
 try{
  if(type==='reset'){
   if(!window.confirm('Réinitialiser la tournée fictive pour toutes les sessions ?'))return;
   const {snapshot:next}=await api('/api/reset',{method:'POST',body:JSON.stringify({confirm:'RESET_DEMO_ONLY'})});
   snapshot=next;notice='Démonstration réinitialisée.';
  }else{
   const commandId='DEMO-'+crypto.randomUUID();
   const result=await api('/api/action',{method:'POST',
     body:JSON.stringify({type,payload,expectedRevision:snapshot.revision,commandId})});
   snapshot=result.snapshot;
   notice=result.alreadyApplied?'Commande déjà prise en compte.':'Action prise en compte par le serveur de démonstration.';
  }
  connected=true;redraw();
 }catch(e){
  notice='Erreur : '+(e.message==='STALE_REVISION'?'une autre session a modifié la tournée ; vérifiez les données avant de recommencer.':e.message);
  await refresh();redraw();
 }finally{busy=false;}
}
root.addEventListener('click',event=>{
 const selected=event.target.closest('button');
 if(!selected||selected.disabled)return;
 if(selected.dataset.join){void join(selected.dataset.join);return;}
 if(selected.dataset.type){
  let p={};
  try{p=JSON.parse(selected.dataset.payload||'{}')}catch{return}
  void command(selected.dataset.type,p);
 }
});
root.addEventListener('submit',event=>{
 if(event.target?.id!=='stop-request')return;
 event.preventDefault();
 const stop=event.target.elements.namedItem('stop').value;
 const child=snapshot?.children?.[0];
 if(!child)return;
 void command('request_change',{studentId:child.studentId,toStopId:stop,
  recipientId:profile==='parent'?'PA-DEMO':'PB-DEMO'});
});

// Every browser tab independently acquires its own non-persistent DEMO test token.
const autoProfile=new URLSearchParams(window.location.search).get('profile');
if(Object.hasOwn(titles,autoProfile))void join(autoProfile);
