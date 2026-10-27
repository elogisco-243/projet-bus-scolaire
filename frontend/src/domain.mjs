import { seed } from './demo-data.mjs';

export const accounts = Object.freeze({
  admin: Object.freeze({ role: 'admin', title: 'Administration scolaire', id: 'ADM-A', schoolId: 'SCH-A', orgId: 'SCH-A' }),
  operator: Object.freeze({ role: 'operator', title: 'Transporteur', id: 'OPUSER-A', operatorId: 'OP-A', orgId: 'OP-A' }),
  driver: Object.freeze({ role: 'driver', title: 'Chauffeur', id: 'DRV-A', operatorId: 'OP-A', orgId: 'OP-A' }),
  parent: Object.freeze({ role: 'parent', title: 'Parent', id: 'PAR-A', schoolId: 'SCH-A', orgId: 'SCH-A' })
});

export const makeState = () => structuredClone(seed);
export const routeOf = (s, t) => s.routes.find(r => r.id === t.routeId);
export const vehicleOf = (s, t) => s.vehicles.find(v => v.id === t.vehicleId);
export const driverOf = (s, t) => s.drivers.find(d => d.id === t.driverId);
export const studentOf = (s, id) => s.students.find(x => x.id === id);
export const tripOf = (s, id) => s.trips.find(t => t.id === id);
const linked = (s, parentId, studentId) => s.verifiedLinks.some(l => l.parentId === parentId && l.studentId === studentId && l.active);
export function visibleStudents(s, actor) {
  if (actor.role === 'admin') return s.students.filter(st => st.schoolId === actor.schoolId);
  if (actor.role === 'parent') return s.students.filter(st => st.parentId === actor.id && st.schoolId === actor.schoolId && linked(s, actor.id, st.id));
  if (actor.role === 'driver') return s.students.filter(st => {
    const t = tripOf(s, st.tripId);
    return Boolean(t && t.driverId === actor.id && routeOf(s,t)?.operatorId === actor.operatorId);
  });
  return [];
}
export function canViewTrip(s, actor, t) {
  if (!t) return false;
  const route = routeOf(s, t);
  if (!route) return false;
  if (actor.role === 'admin') return route.schoolId === actor.schoolId;
  if (actor.role === 'operator') return route.operatorId === actor.operatorId;
  if (actor.role === 'driver') return t.driverId === actor.id && route.operatorId === actor.operatorId;
  if (actor.role === 'parent') return route.schoolId === actor.schoolId &&
    s.students.some(st => st.tripId === t.id && st.schoolId === route.schoolId && st.parentId === actor.id && linked(s,actor.id,st.id));
  return false;
}
export const visibleTrips = (s, actor) => s.trips.filter(t => canViewTrip(s,actor,t));
export const visibleVehicles = (s,actor) => actor.role === 'operator' ? s.vehicles.filter(v => v.operatorId === actor.operatorId) : [];
export const visibleIncidents = (s,actor) => s.incidents.filter(i => canViewTrip(s,actor,tripOf(s,i.tripId)) && actor.role !== 'parent');
export function visibleNotifications(s, actor) {
  if (actor.role !== 'parent') return [];
  return s.notifications.filter(n => n.parentId === actor.id);
}
function fail(message) { throw new Error(message); }
function check(ok, message = 'Action non autorisée dans ce profil') { if (!ok) fail(message); }
function next(s, category, label) {
  const copy = structuredClone(s);
  copy.history.unshift({ id: `EV-${copy.nextId++}`, category, label });
  copy.history = copy.history.slice(0, 16);
  return copy;
}
function cleanText(value, max = 70) {
  const t = String(value ?? '').trim().replace(/\s+/g,' ');
  check(t.length >= 2 && t.length <= max, `Saisis un texte entre 2 et ${max} caractères`);
  return t;
}
function notifyParents(s,t,body) {
  const route = routeOf(s,t);
  for (const st of s.students.filter(x => x.tripId === t.id && x.schoolId === route?.schoolId)) {
    if (!linked(s,st.parentId,st.id) || (st.parentId === 'PAR-A' && !s.alertsEnabled)) continue;
    s.notifications.unshift({ id: `N-${s.nextId++}`, parentId: st.parentId, tripId:t.id, text:body, read:false });
  }
}
export function addStudent(s, actor, rawRef) {
  check(actor.role === 'admin');
  const ref = cleanText(rawRef,28);
  check(!s.students.some(st => st.schoolId === actor.schoolId && st.ref.toLowerCase() === ref.toLowerCase()), 'Référence déjà utilisée');
  const result = next(s,'school',`Référence fictive ${ref} créée`);
  result.students.push({ id:`ST-${result.nextId++}`,ref,schoolId:actor.schoolId,tripId:null,parentId:null,absence:false });
  return result;
}
export function addVehicle(s, actor, rawCode, rawSeats) {
  check(actor.role === 'operator');
  const code = cleanText(rawCode,16).toUpperCase();
  const seats = Number(rawSeats);
  check(Number.isInteger(seats) && seats>=1 && seats<=80,'Capacité comprise entre 1 et 80 places');
  check(!s.vehicles.some(v => v.operatorId === actor.operatorId && v.code.toUpperCase()===code),'Code véhicule déjà utilisé');
  const result = next(s,'fleet',`Bus ${code} ajouté à la flotte de démonstration`);
  result.vehicles.push({ id:`BUS-${result.nextId++}`,code,seats,operatorId:actor.operatorId,status:'disponible' });
  return result;
}
export function assignDriver(s, actor, tripId, driverId) {
  const t=tripOf(s,tripId),r=t&&routeOf(s,t),d=s.drivers.find(x=>x.id===driverId);
  check(actor.role==='operator'&&r?.operatorId===actor.operatorId,'Transporteur non autorisé');
  check(t.status==='planned','Affectation réservée aux tournées planifiées');
  check(d?.active && d.operatorId===r.operatorId,'Chauffeur hors transporteur');
  const result=next(s,'fleet',`${d.ref} affecté à ${r.name}`);
  tripOf(result,tripId).driverId=driverId;
  return result;
}
function ownDriverTrip(s,actor,tripId){
  const t=tripOf(s,tripId),r=t&&routeOf(s,t);
  check(actor.role==='driver'&&t?.driverId===actor.id && r?.operatorId===actor.operatorId,'Tournée non autorisée');
  return t;
}
export function startTrip(s,actor,tripId){
  const t=ownDriverTrip(s,actor,tripId);
  check(t.status==='planned','La tournée ne peut plus être démarrée');
  check(s.driverOnline,'Reconnecte le téléphone pour démarrer la tournée');
  const result=next(s,'trip',`Départ fictif du trajet ${tripId}`);
  tripOf(result,tripId).status='in_progress';
  notifyParents(result,tripOf(result,tripId),'Le bus a démarré sa tournée (simulation).');
  return result;
}
export function advanceTrip(s,actor,tripId){
  const t=ownDriverTrip(s,actor,tripId);
  check(t.status==='in_progress','Démarre la tournée avant de progresser');
  check(t.progress<100,'Fin de parcours déjà atteinte');
  const result=next(s,'gps','Étape de parcours simulée enregistrée');
  const tr=tripOf(result,tripId),route=routeOf(result,tr);
  tr.progress=Math.min(100,tr.progress+25);
  tr.lastStop=route.stops[Math.min(route.stops.length-1,Math.floor(tr.progress/100*(route.stops.length-1)))];
  if(result.driverOnline){tr.publishedProgress=tr.progress;notifyParents(result,tr,`Mise à jour du trajet : ${tr.progress}% (simulation).`);} else {
    result.outbox.push({id:`Q-${result.nextId++}`,tripId,progress:tr.progress});
  }
  return result;
}
export function setDriverOnline(s,actor,online){
  check(actor.role==='driver');
  const result=next(s,'network',online?'Connexion simulée rétablie':'Mode hors ligne simulé');
  result.driverOnline=Boolean(online);
  if(online && result.outbox.length){
    const ids=new Set(result.outbox.map(q=>q.tripId));
    for(const id of ids){
      const t=tripOf(result,id);if(t && canViewTrip(result,actor,t)){
        t.publishedProgress=t.progress;
        notifyParents(result,t,`Synchronisation du parcours : ${t.progress}% (simulation).`);
      }
    }
    result.outbox=[];
  }
  return result;
}
export function boardStudent(s,actor,tripId,studentId){
  const t=ownDriverTrip(s,actor,tripId),st=studentOf(s,studentId),r=routeOf(s,t);
  check(t.status==='in_progress','La tournée doit être en cours');
  check(st?.tripId===tripId && st.schoolId===r.schoolId,'Élève non autorisé sur cette tournée');
  check(!st.absence,'Absence déclarée pour cette tournée');
  check(!t.boarded.includes(studentId),'Prise en charge déjà confirmée');
  const result=next(s,'boarding',`Prise en charge fictive de ${st.ref}`);
  tripOf(result,tripId).boarded.push(studentId);
  notifyParents(result,tripOf(result,tripId),`Prise en charge confirmée pour ${st.ref} (simulation).`);
  return result;
}
export function finishTrip(s,actor,tripId){
  const t=ownDriverTrip(s,actor,tripId);
  check(t.status==='in_progress','La tournée doit être en cours');
  const result=next(s,'trip',`Tournée ${tripId} terminée (simulation)`);
  const tr=tripOf(result,tripId);tr.status='completed';tr.progress=100;
  if(result.driverOnline){tr.publishedProgress=100;notifyParents(result,tr,'La tournée est terminée (simulation).');}
  else result.outbox.push({id:`Q-${result.nextId++}`,tripId,progress:100});
  return result;
}
export function reportIncident(s,actor,tripId,note,level='info'){
  ownDriverTrip(s,actor,tripId);
  check(['info','warning'].includes(level),'Niveau inconnu');
  const comment=cleanText(note,180);
  const result=next(s,'incident','Incident fictif signalé');
  result.incidents.unshift({id:`INC-${result.nextId++}`,tripId,level,note:comment,status:'open'});
  return result;
}
export function resolveIncident(s,actor,incidentId){
  const i=s.incidents.find(x=>x.id===incidentId);
  check(i && i.status==='open' && actor.role==='operator' &&
    routeOf(s,tripOf(s,i.tripId))?.operatorId===actor.operatorId,'Incident non autorisé');
  const result=next(s,'incident',`Incident ${incidentId} résolu dans la démonstration`);
  result.incidents.find(x=>x.id===incidentId).status='resolved';
  return result;
}
export function toggleAbsence(s,actor,studentId){
  const st=studentOf(s,studentId),t=st&&tripOf(s,st.tripId);
  check(actor.role==='parent' && st?.parentId===actor.id && st?.schoolId===actor.schoolId && linked(s,actor.id,st.id),'Élève non autorisé');
  check(t?.status==='planned','Absence modifiable uniquement avant le départ');
  const result=next(s,'parent',`Absence fictive mise à jour : ${st.ref}`);
  result.students.find(x=>x.id===st.id).absence=!st.absence;
  return result;
}
export function toggleAlerts(s,actor){
  check(actor.role==='parent');
  const result=next(s,'parent','Préférence de notification fictive modifiée');
  result.alertsEnabled=!result.alertsEnabled;
  return result;
}
export function readNotifications(s,actor){
  check(actor.role==='parent');
  const result=structuredClone(s);
  result.notifications.forEach(n=>{if(n.parentId===actor.id)n.read=true});
  return result;
}
export const statusName = status => ({planned:'Planifié',in_progress:'En cours',completed:'Terminé',cancelled:'Annulé'})[status]||status;
