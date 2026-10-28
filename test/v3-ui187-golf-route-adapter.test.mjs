import test from 'node:test';
import assert from 'node:assert/strict';
import {GOLF_ROUTE,createGolfDemoSnapshot,projectGolfDemo,validateGolfSnapshot,applyOperationalGolfAction,verifyRemoteGolfSync} from '../mobile-session19/golf-route-adapter.mjs';
test('route matches adopted Chauffeur Golf and LUB-014',()=>{
 assert.deepEqual(GOLF_ROUTE.stops.map(x=>x.name),['Dépôt','Golf','Centre','École Horizon']);
 assert.equal(GOLF_ROUTE.busId,'LUB-014');
 assert.equal(GOLF_ROUTE.pupils.length,4);
});
test('all four role projections share identical trip key and revision',()=>{
 const s=createGolfDemoSnapshot();
 const views=['driver','attendant','parent','supervisor'].map(role=>projectGolfDemo(s,role));
 assert.equal(views.every(x=>x.ok&&x.routeId===s.routeId&&x.revision===0),true);
 assert.equal(views.every(x=>x.stopsTotal===4&&x.nextStop==='Dépôt'),true);
});
test('progression appears consistently in distinct projections',()=>{
 const s=createGolfDemoSnapshot();s.status='in_progress';s.revision=2;
 s.stops[0].reached=true;s.currentStopId=s.stops[0].id;
 s.students[0].boarded=true;
 const views=['driver','attendant','parent','supervisor'].map(r=>projectGolfDemo(s,r));
 assert.equal(views.every(x=>x.stopsReached===1&&x.onboard===1&&x.nextStop==='Golf'),true);
});
test('invalid roster, stop order, role and mode rejected',()=>{
 const s=createGolfDemoSnapshot();
 assert.equal(projectGolfDemo(s,'admin').code,'ROLE_UNKNOWN');
 s.stops.reverse();assert.equal(validateGolfSnapshot(s).code,'STOP_SEQUENCE_MISMATCH');
 s.stops.reverse();s.mode='operational';
 assert.equal(validateGolfSnapshot(s).code,'GOLF_ROUTE_MISMATCH');
});
test('no operational dispatch or fabricated remote synchronization',()=>{
 assert.equal(applyOperationalGolfAction().code,'OPERATIONAL_DISPATCH_DISABLED');
 assert.equal(verifyRemoteGolfSync().code,'TRUSTED_SERVER_SYNC_REQUIRED');
});
