import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {DRIVER_APK_ICONS,DRIVER_UI145_SPEC} from '../mobile-session19/driver-ui145-reference.mjs';
import {checkArrivedStop,checkStudentAtStop,checkClosure,verifyCrossRoleApproval,DRIVER_REFERENCE} from '../mobile-session19/shared-trip-contract.mjs';
import {makeAttendantDemo,runAttendantDemo,attendantSummary,attendantClosingChecklist,INCIDENTS,CRITICAL_INCIDENTS} from '../mobile-session19/attendant-demo.mjs';
const read=p=>readFileSync(fileURLToPath(new URL(p,import.meta.url)),'utf8');
const ui=read('../mobile-session19/app.mjs');
const css=read('../mobile-session19/style.css');
const build=read('../scripts/build-attendant-testhost.mjs');
function browser(){
 let clickFn;
 const root={innerHTML:'',addEventListener(event,fn){if(event==='click')clickFn=fn;}};
 vm.runInNewContext(ui.replace(/^import .*;\s*$/m,''),{document:{querySelector:()=>root},
  makeAttendantDemo,runAttendantDemo,attendantSummary,attendantClosingChecklist,INCIDENTS,CRITICAL_INCIDENTS},{timeout:3000});
 return {html:()=>root.innerHTML,click:(action,arg='',isTab=false)=>clickFn({target:{closest:()=>({disabled:false,dataset:isTab?{tab:action}:{action,arg}})}})};
}
const driverStops=DRIVER_UI145_SPEC.route.map((name,index)=>({id:'D-'+index,name,reached:false}));
const pupil={id:'A-01',pickupStopId:'D-1',dropoffStopId:'D-3',boarded:false,alighted:false,absent:false};
test('UI160/01: reference source from supplied UI145 driver APK',()=>{
 assert.equal(DRIVER_UI145_SPEC.apkSha256,'e34e8cc404c91cca3058a5c01394f5961f22603864716f851139413e5d5d27fe');
 assert.equal(DRIVER_UI145_SPEC.versionName,'1.7');
 assert.deepEqual([...DRIVER_UI145_SPEC.route],['Dépôt','Golf','Centre','École Horizon']);
 assert.equal(DRIVER_REFERENCE.totalDriverArrivalEvents,3);
});
test('UI160/02: exact action labels and navigation tabs from Chauffeur APK',()=>{
 assert.deepEqual([...DRIVER_UI145_SPEC.buttons],['DÉMARRER LA COURSE','NOUVELLE TOURNÉE','ARRÊT ATTEINT','CLÔTURER LA COURSE']);
 assert.deepEqual([...DRIVER_UI145_SPEC.tabs],['Ma tournée','Alertes','Équipe','Plus']);
 const html=browser().html();
 for(const label of [...DRIVER_UI145_SPEC.buttons,...DRIVER_UI145_SPEC.tabs])assert.ok(html.includes(label));
 assert.doesNotMatch(html,/data-tab="boarding"/);
});
test('UI160/03: icon paths inherited from original Chauffeur APK',()=>{
 for(const key of ['nav-bus','alert','team','more','play','refresh','pin','flag','speaker','wifi','wifi-off']){
  assert.equal(typeof DRIVER_APK_ICONS[key],'string');
  assert.ok(ui.includes(DRIVER_APK_ICONS[key]),key+' path not found in UI');
 }
 assert.match(ui,/stroke-width="2"/);
});
test('UI160/04: exact responsive next-stop typography and colors',()=>{
 assert.match(css,/\.next-stop \.next-stop-info strong/);
 assert.match(css,/color:#ffe48a!important/);
 assert.match(css,/font-size:clamp\(16px,4vw,20px\)!important/);
 assert.match(css,/text-overflow:ellipsis/);
});
test('UI160/05: matching 26px, 23px and 25px SVG icon sizes',()=>{
 assert.match(css,/\.bottom \.nav-icon \.ui-icon\{width:25px!important;height:25px!important/);
 assert.match(css,/\.dashboard-actions \.dash-action \.ui-icon\{width:26px!important;height:26px!important/);
 assert.match(css,/width:23px!important;height:23px!important/);
 assert.match(css,/height:clamp\(78px,10\.5dvh,92px\)/);
 assert.match(css,/height:clamp\(68px,9\.6dvh,78px\)!important/);
});
test('UI160/06: simulated Wi-Fi active and offline states are distinct',()=>{
 const h=browser();assert.match(h.html(),/network-icon wifi-online/);
 h.click('more','',true);h.click('go_sync');h.click('network');h.click('tour','',true);
 assert.match(h.html(),/network-icon wifi-offline/);
 assert.match(h.html(),/sans serveur réel/);
});
test('UI160/07: pupil boarding requires physically signalled stop in demo model',()=>{
 const stops=driverStops.map(x=>({...x}));
 const opts={started:true,parked:true,atStop:true,activeStopId:'D-1',stops,student:pupil,action:'board'};
 assert.equal(checkStudentAtStop(opts).code,'STOP_NOT_CONFIRMED');
 stops[0].reached=true;stops[1].reached=true;
 assert.equal(checkStudentAtStop(opts).ok,true);
 assert.equal(checkStudentAtStop({...opts,activeStopId:'D-2'}).code,'STOP_NOT_CONFIRMED');
 assert.equal(checkStudentAtStop({...opts,student:{...pupil,pickupStopId:'D-2'}}).code,'PUPIL_WRONG_STOP');
});
test('UI160/08: out-of-order stop and vehicle moving refuse pointage',()=>{
 const stops=driverStops.map((x,i)=>({...x,reached:i!==2}));
 const opts={started:true,parked:true,atStop:true,activeStopId:'D-1',stops,student:pupil,action:'board'};
 assert.equal(checkArrivedStop(opts).code,'STOP_ORDER_CONFLICT');
 assert.equal(checkStudentAtStop({...opts,parked:false}).code,'VEHICLE_NOT_SECURED_AT_STOP');
});
test('UI160/09: duplicate, absent and wrong dropoff all blocked',()=>{
 const stops=driverStops.map((x,i)=>({...x,reached:i<=1}));
 const opts={started:true,parked:true,atStop:true,activeStopId:'D-1',stops,student:pupil,action:'board'};
 assert.equal(checkStudentAtStop({...opts,student:{...pupil,boarded:true}}).code,'DUPLICATE_BOARDING');
 assert.equal(checkStudentAtStop({...opts,student:{...pupil,absent:true}}).code,'REPORTED_ABSENT');
 assert.equal(checkStudentAtStop({...opts,action:'alight',student:{...pupil,boarded:true}}).code,'PUPIL_WRONG_STOP');
});
test('UI160/10: closing requires all stops, reconciled children, final inspection',()=>{
 const stops=driverStops.map(x=>({...x,reached:true}));
 const end={started:true,parked:true,atStop:true,activeStopId:'D-3',stops,students:[pupil],unresolvedAlerts:0,inspectionConfirmed:true};
 assert.equal(checkClosure(end).code,'STUDENTS_NOT_RECONCILED');
 assert.equal(checkClosure({...end,students:[{...pupil,boarded:true}]}).code,'CHILDREN_REMAIN');
 assert.equal(checkClosure({...end,students:[{...pupil,boarded:true,alighted:true}],inspectionConfirmed:false}).code,'FINAL_INSPECTION_REQUIRED');
 assert.equal(checkClosure({...end,students:[{...pupil,boarded:true,alighted:true}],unresolvedAlerts:1}).code,'OPEN_INCIDENTS');
 assert.equal(checkClosure({...end,students:[{...pupil,boarded:true,alighted:true}]}).ok,true);
});
test('UI160/11: fake cross-role confirmations always fail closed',()=>{
 assert.equal(verifyCrossRoleApproval({driverApproved:true,attendantApproved:true,mode:'operational'}).code,'TRUSTED_SERVER_VERIFICATION_REQUIRED');
});
test('UI160/12: DEMO model now refuses forged arrival flag',()=>{
 let s=makeAttendantDemo();s=runAttendantDemo(s,'demo_prepare_departure');s=runAttendantDemo(s,'start_demo_trip');
 assert.throws(()=>runAttendantDemo(s,'board',{studentId:'E-01'}),/VEHICLE_NOT_SECURED_AT_STOP/);
 s=runAttendantDemo(s,'simulate_arrival');
 const forged=structuredClone(s);forged.stops[0].reached=false;
 assert.throws(()=>runAttendantDemo(forged,'board',{studentId:'E-01'}),/STOP_NOT_CONFIRMED/);
 assert.equal(runAttendantDemo(s,'board',{studentId:'E-01'}).trip.onboardCount,1);
});
test('UI160/13: testhost bundles the contract without operational network access',()=>{
 assert.match(build,/shared-trip-contract\.mjs/);
 assert.match(build,/LOCAL_SIMULATION_ONLY/);
 assert.match(build,/cd\.eneo360\.busscolaire\.v3\.sync09\.test/);
 assert.match(build,/connect-src \\'none\\'/);
});
test.todo('UI160/BLOCKER: two authenticated Android devices, signed cross-role approvals and real synchronization');
