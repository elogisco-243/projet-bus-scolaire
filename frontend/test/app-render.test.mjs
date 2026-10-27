import test from 'node:test';
import assert from 'node:assert/strict';

const events=new Map();
const fakeRoot={innerHTML:'',addEventListener:(event,fn)=>events.set(event,fn)};
globalThis.document={getElementById:id=>id==='app'?fakeRoot:null};
await import('../src/app.mjs');
function click(properties){
  const button={dataset:properties};
  events.get('click')({target:{closest:selector=>selector==='button'?button:null}});
}

test('les quatre profils se rendent et présentent uniquement des références fictives',()=>{
 assert.match(fakeRoot.innerHTML,/Vue générale/);
 assert.match(fakeRoot.innerHTML,/Références élèves/);
 click({role:'operator'});
 assert.match(fakeRoot.innerHTML,/Centre de transport/);
 assert.match(fakeRoot.innerHTML,/Ma flotte/);
 click({role:'driver'});
 assert.match(fakeRoot.innerHTML,/Ma tournée du matin/);
 click({role:'parent'});
 assert.match(fakeRoot.innerHTML,/Suivi de mon bus/);
 assert.match(fakeRoot.innerHTML,/Dernière étape publiée : 0%/);
 assert.doesNotMatch(fakeRoot.innerHTML,/Élève B-01/);
});
test('parcours interface chauffeur vers parent en mode hors ligne',()=>{
 click({role:'driver'});
 click({action:'start',id:'TRIP-A'});
 click({action:'advance',id:'TRIP-A'});
 click({action:'connection'});
 click({action:'advance',id:'TRIP-A'});
 click({role:'parent'});
 assert.match(fakeRoot.innerHTML,/Dernière étape publiée : 25%/);
 click({role:'driver'});
 click({action:'connection'});
 click({role:'parent'});
 assert.match(fakeRoot.innerHTML,/Dernière étape publiée : 50%/);
});
test('retour au jeu fictif initial possible',()=>{
 click({action:'reset'});
 assert.match(fakeRoot.innerHTML,/Vue générale/);
 assert.match(fakeRoot.innerHTML,/Élèves référencés/);
});
