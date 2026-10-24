import test from 'node:test';
import assert from 'node:assert/strict';
import {
 accounts,makeState,visibleStudents,visibleTrips,visibleVehicles,visibleIncidents,visibleNotifications,
 addStudent,addVehicle,assignDriver,startTrip,advanceTrip,setDriverOnline,boardStudent,finishTrip,
 reportIncident,resolveIncident,toggleAbsence,toggleAlerts,readNotifications
} from '../src/domain.mjs';
const {admin,operator,driver,parent}=accounts;
const expectDenied=(fn)=>assert.throws(fn,/non autoris|non autorisé|réservée|autorisée|affectation|affecté|Action/i);

test('jeu de données entièrement synthétique et indépendant entre sessions',()=>{
 const a=makeState(),b=makeState();a.schools[0].name='Mutation locale';
 assert.notEqual(a.schools[0].name,b.schools[0].name);
 assert.equal(b.students.some(s=>s.ref.includes('Élève A-01')),true);
});
test('administration scolaire A ne voit aucune référence de l’école B',()=>{
 const s=makeState();assert.deepEqual(visibleStudents(s,admin).map(x=>x.id).sort(),['ST-A','ST-B','ST-D']);
 assert.deepEqual(visibleTrips(s,admin).map(x=>x.id).sort(),['TRIP-A','TRIP-B']);
});
test('transporteur A voit seulement ses bus, ses trajets et ses incidents',()=>{
 const s=makeState();assert.deepEqual(visibleVehicles(s,operator).map(x=>x.id),['BUS-A','BUS-B']);
 assert.deepEqual(visibleTrips(s,operator).map(x=>x.id),['TRIP-A','TRIP-B']);
 assert.equal(visibleIncidents(s,operator).length,1);
 assert.equal(visibleStudents(s,operator).length,0);
});
test('parent A voit seulement la référence enfant vérifiée et le trajet associé',()=>{
 const s=makeState();assert.deepEqual(visibleStudents(s,parent).map(x=>x.id),['ST-A']);
 assert.deepEqual(visibleTrips(s,parent).map(x=>x.id),['TRIP-A']);
 assert.deepEqual(visibleIncidents(s,parent),[]);
 assert.deepEqual(visibleVehicles(s,parent),[]);
});
test('révocation parent-enfant retire immédiatement l’accès dans la démo',()=>{
 const s=makeState();s.verifiedLinks[0].active=false;
 assert.deepEqual(visibleStudents(s,parent),[]);assert.deepEqual(visibleTrips(s,parent),[]);
});
test('seul un administrateur de l’école peut ajouter une référence fictive',()=>{
 let s=makeState();expectDenied(()=>addStudent(s,operator,'Élève A-11'));
 s=addStudent(s,admin,'Élève A-11');assert.equal(visibleStudents(s,admin).length,4);
 assert.ok(s.students.some(x=>x.ref==='Élève A-11'&&x.schoolId==='SCH-A'&&x.parentId===null));
 assert.throws(()=>addStudent(s,admin,'élève a-11'),/déjà utilisée/);
});
test('référence non vide et validée, sans double enregistrement',()=>{
 const s=makeState();assert.throws(()=>addStudent(s,admin,' '),/entre 2/);
 assert.throws(()=>addStudent(s,admin,'x'.repeat(29)),/entre 2/);
});
test('seul le transporteur A peut ajouter son véhicule, avec code unique et capacité valide',()=>{
 const s=makeState();expectDenied(()=>addVehicle(s,admin,'LUB-099',18));
 assert.throws(()=>addVehicle(s,operator,'LUB-014',18),/déjà utilisé/);
 assert.throws(()=>addVehicle(s,operator,'LUB-099',0),/1 et 80/);
 const next=addVehicle(s,operator,'lub-099',24);
 assert.equal(next.vehicles.at(-1).code,'LUB-099');assert.equal(next.vehicles.at(-1).operatorId,'OP-A');
});
test('affectation interdite hors transporteur et pendant une tournée active',()=>{
 const s=makeState();expectDenied(()=>assignDriver(s,operator,'TRIP-C','DRV-B'));
 assert.throws(()=>assignDriver(s,operator,'TRIP-A','DRV-C'),/hors transporteur/);
 assert.throws(()=>assignDriver(s,operator,'TRIP-C','DRV-C'),/non autorisé/);
});
test('affectation interne modifie uniquement une tournée planifiée',()=>{
 const s=assignDriver(makeState(),operator,'TRIP-B','DRV-A');
 assert.equal(s.trips.find(t=>t.id==='TRIP-B').driverId,'DRV-A');
});
test('chauffeur A ne peut démarrer la tournée B ou C',()=>{
 const s=makeState();expectDenied(()=>startTrip(s,driver,'TRIP-B'));
 expectDenied(()=>startTrip(s,driver,'TRIP-C'));
});
test('démarrage autorisé avertit seulement les parents liés',()=>{
 const s=startTrip(makeState(),driver,'TRIP-A');
 assert.equal(s.trips[0].status,'in_progress');
 assert.deepEqual(s.notifications.map(x=>x.parentId).sort(),['PAR-A','PAR-B']);
 assert.equal(visibleNotifications(s,parent).length,1);
 assert.equal(s.notifications.some(x=>x.parentId==='PAR-C'),false);
});
test('une tournée ne démarre pas hors ligne et ne se démarre pas deux fois',()=>{
 const s=makeState();assert.throws(()=>startTrip(setDriverOnline(s,driver,false),driver,'TRIP-A'),/Reconnecte/);
 const active=startTrip(s,driver,'TRIP-A');assert.throws(()=>startTrip(active,driver,'TRIP-A'),/ne peut plus/);
});
test('progression fictive en ligne publie sa dernière étape',()=>{
 let s=startTrip(makeState(),driver,'TRIP-A');s=advanceTrip(s,driver,'TRIP-A');
 assert.equal(s.trips[0].progress,25);assert.equal(s.trips[0].publishedProgress,25);
 assert.equal(visibleNotifications(s,parent).length,2);
});
test('hors ligne, la progression privée reste masquée du parent puis se synchronise',()=>{
 let s=startTrip(makeState(),driver,'TRIP-A');s=setDriverOnline(s,driver,false);
 s=advanceTrip(s,driver,'TRIP-A');s=advanceTrip(s,driver,'TRIP-A');
 assert.equal(s.trips[0].progress,50);assert.equal(s.trips[0].publishedProgress,0);
 assert.equal(s.outbox.length,2);s=setDriverOnline(s,driver,true);
 assert.equal(s.trips[0].publishedProgress,50);assert.equal(s.outbox.length,0);
});
test('mise à jour d’une autre tournée ou avant départ interdite',()=>{
 const s=makeState();expectDenied(()=>advanceTrip(s,driver,'TRIP-C'));
 assert.throws(()=>advanceTrip(s,driver,'TRIP-A'),/Démarre/);
});
test('prise en charge sans liste croisée, sans doublon et sans absence',()=>{
 let s=startTrip(makeState(),driver,'TRIP-A');
 assert.throws(()=>boardStudent(s,driver,'TRIP-A','ST-C'),/non autorisé/);
 s=boardStudent(s,driver,'TRIP-A','ST-A');assert.deepEqual(s.trips[0].boarded,['ST-A']);
 assert.throws(()=>boardStudent(s,driver,'TRIP-A','ST-A'),/déjà confirmée/);
});
test('parent peut signaler une absence seulement avant le départ et pour sa référence',()=>{
 let s=makeState();expectDenied(()=>toggleAbsence(s,operator,'ST-A'));
 expectDenied(()=>toggleAbsence(s,parent,'ST-B'));
 s=toggleAbsence(s,parent,'ST-A');assert.equal(s.students[0].absence,true);
 s=startTrip(s,driver,'TRIP-A');assert.throws(()=>boardStudent(s,driver,'TRIP-A','ST-A'),/Absence déclarée/);
 assert.throws(()=>toggleAbsence(s,parent,'ST-A'),/avant le départ/);
});
test('fin de tournée et état final',()=>{
 let s=startTrip(makeState(),driver,'TRIP-A');s=finishTrip(s,driver,'TRIP-A');
 assert.equal(s.trips[0].status,'completed');assert.equal(s.trips[0].publishedProgress,100);
 assert.throws(()=>finishTrip(s,driver,'TRIP-A'),/en cours/);
});
test('incidents : chauffeur affecté et résolution par transporteur autorisé uniquement',()=>{
 let s=makeState();expectDenied(()=>reportIncident(s,operator,'TRIP-A','Incident fictif'));
 s=reportIncident(s,driver,'TRIP-A','Retard de circulation simulé','warning');
 const id=s.incidents[0].id;expectDenied(()=>resolveIncident(s,admin,id));
 s=resolveIncident(s,operator,id);assert.equal(s.incidents[0].status,'resolved');
});
test('injection HTML reste du texte et ne confère jamais des droits',()=>{
 const s=addStudent(makeState(),admin,'<img onerror=x>');
 assert.ok(s.students.at(-1).ref.includes('<img'));
 assert.equal(visibleStudents(s,parent).some(x=>x.ref.includes('<img')),false);
});
test('préférences parent suppriment les futures alertes fictives',()=>{
 let s=toggleAlerts(makeState(),parent);
 assert.equal(s.alertsEnabled,false);s=startTrip(s,driver,'TRIP-A');
 assert.deepEqual(s.notifications.map(x=>x.parentId),['PAR-B']);
 expectDenied(()=>toggleAlerts(s,driver));
});
test('lecture de notifications ne modifie pas celles d’autres parents',()=>{
 let s=startTrip(makeState(),driver,'TRIP-A');s=readNotifications(s,parent);
 assert.equal(s.notifications.find(n=>n.parentId==='PAR-A').read,true);
 assert.equal(s.notifications.find(n=>n.parentId==='PAR-B').read,false);
});
