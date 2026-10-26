import test from 'node:test';import assert from 'node:assert/strict';import {makeDemo,canUseMap,begin,arrive,alertEvent,setNetwork,sync,parentFeed,record} from '../lot7/model.mjs';
test('freemium: pas de carte, GPS: carte parent seulement',()=>{assert.equal(canUseMap('parent','freemium'),false);assert.equal(canUseMap('parent','gps'),true);assert.equal(canUseMap('driver','gps'),false);});
test('arrêt enregistré localement hors ligne puis synchronisé',()=>{let s=begin(makeDemo());s=setNetwork(s,false);s=arrive(s);assert.equal(s.events[0].synced,false);assert.equal(sync(s).events[0].synced,false);s=sync(setNetwork(s,true));assert.equal(s.events.every(e=>e.synced),true);});
test('notifications parent excluent les événements non synchronisés',()=>{let s=record(makeDemo(),'Montée confirmée');assert.equal(parentFeed(s).length,1);s=sync(s);assert.equal(parentFeed(s).length,2);});
test('signalement d’embouteillage et d’urgence',()=>{let s=begin(makeDemo());s=alertEvent(s,'Embouteillage');s=alertEvent(s,'Urgence médicale');assert.equal(s.alerts.length,2);});
test('arrêt impossible avant départ',()=>{const s=makeDemo();assert.deepEqual(arrive(s),s);});
