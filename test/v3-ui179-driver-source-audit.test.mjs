import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const attendant=read('../mobile-session19/app.mjs');
const frontend=read('../frontend/src/app.mjs');
const host=read('../android-sync07/testhost/src/main/assets/public/index.html');
test('UI179/01: complete UI-170 Attendant has its own module and is preserved',()=>{
 assert.match(attendant,/import \{inspectAttendantGesture\} from '\.\/action-boundary\.mjs'/);
 assert.match(attendant,/indicator-onboard/);
 assert.match(attendant,/closing-primary-action/);
});
test('UI179/02: earlier frontend driver is a separate generic screen; not approved mobile layout',()=>{
 assert.match(frontend,/driver: \[ \['overview','Ma tournée'/);
 assert.match(frontend,/boarding','Prise en charge'/);
 assert.doesNotMatch(frontend,/DÉMARRER LA COURSE/);
 assert.doesNotMatch(frontend,/NOUVELLE TOURNÉE/);
});
test('UI179/03: Android testhost main entry is a bridge test rather than full Chauffeur',()=>{
 assert.match(host,/Native Bridge TEST/);
 assert.doesNotMatch(host,/DÉMARRER LA COURSE/);
});
test('UI179/04: no silent substitution of driver screen by test interface',()=>{
 assert.equal(/DÉMARRER LA COURSE/.test(frontend),false);
 assert.equal(/DÉMARRER LA COURSE/.test(attendant),true);
});
test.todo('UI179/REAL: locate the approved complete Chauffeur Android entry and UI-165/166 assets');
test.todo('UI179/REAL: add Chauffeur action boundary only after visual/source equivalence confirmed');
test.todo('UI179/REAL: build and exercise driver/attendant full APK UI on two Android sessions');
