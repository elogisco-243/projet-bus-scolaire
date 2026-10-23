// Build a demo-only asset bundle for the isolated Android testhost. Never touches production APK.
import {cpSync,copyFileSync,mkdirSync,rmSync,writeFileSync,readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const dest=join(root,'android-sync07','testhost','src','main','assets','public');
const source=join(root,'mobile-session19');
const original=readFileSync(join(root,'android-sync07','testhost','build.gradle'),'utf8');
if(!original.includes("applicationId 'cd.eneo360.busscolaire.v3.sync09.test'"))
 throw Error('TESTHOST_PACKAGE_GUARD_FAILED');
if(!readFileSync(join(root,'mobile-session19','attendant-demo.mjs'),'utf8').includes('LOCAL_SIMULATION_ONLY'))throw Error('DEMO_ONLY_GUARD_FAILED');
rmSync(join(dest,'mobile-session19'),{recursive:true,force:true});
rmSync(join(dest,'mobile-session18'),{recursive:true,force:true});
mkdirSync(join(dest,'mobile-session19'),{recursive:true});
mkdirSync(join(dest,'mobile-session18'),{recursive:true});
for(const name of ['index.html','style.css','app.mjs','attendant-demo.mjs'])copyFileSync(join(source,name),join(dest,'mobile-session19',name));
copyFileSync(join(root,'mobile-session18','attendant-policy.mjs'),join(dest,'mobile-session18','attendant-policy.mjs'));
writeFileSync(join(dest,'index.html'),`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'none'; img-src 'none'; base-uri 'none'; form-action 'none'; object-src 'none'"><title>A2S Scola Test</title></head><body><p>Démo Accompagnateur, sans réseau réel.</p><a href="./mobile-session19/index.html">Ouvrir la démo</a><script type="module">location.replace('./mobile-session19/index.html')</script></body></html>`);
// CSP meta on nested page: no network, inline JS, or external origins permitted.
const nested=join(dest,'mobile-session19','index.html');
const page=readFileSync(nested,'utf8').replace('<head>','<head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'self\'; style-src \'self\'; connect-src \'none\'; img-src \'none\'; base-uri \'none\'; object-src \'none\'">');
writeFileSync(nested,page);
console.log('SYNC19 demo testhost assets prepared at '+dest);
