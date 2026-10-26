import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const file=fileURLToPath(new URL('../scripts/qa-ui168-sessions-synchronisees.ps1',import.meta.url));
const ps=readFileSync(file,'utf8');
const helperFile=fileURLToPath(new URL('../scripts/ui168-emulator-start.ps1',import.meta.url));
const helper=readFileSync(helperFile,'utf8');
test('UI168/PS01: local-only safe Windows test launcher with ASCII encoding',()=>{
 assert.equal(Buffer.byteLength(ps,'utf8'),ps.length,'No non-ASCII characters in PowerShell 5.1 BOMless script');
 assert.match(ps,/feature\/bus-v3-sync18-attendant-qa/);
 assert.match(ps,/127\.0\.0\.1/);
 assert.match(ps,/mobile-session21\\demo-hub\.mjs/);
 assert.match(ps,/node|Node/);
 assert.match(ps,/v3-ui168-synchronized-profiles\.test\.mjs/);
 assert.match(ps,/Recette-synchronisee-UI168\.csv/);
 assert.doesNotMatch(ps,/git\s+push|git\s+checkout|git\s+merge|gradle|Render|kubectl/);
});
test('UI168/PS02: parent, supervisor and both crew profiles have independent test links',()=>{
 for(const name of ['chauffeur','accompagnateur','parent','superviseur']){
  assert.match(ps,new RegExp('profile='+name));
 }
 assert.match(ps,/OpenAndroidEmulator/);
 assert.match(ps,/ui168-emulator-start\.ps1/);
 assert.match(helper,/reverse/);
 assert.match(helper,/Start-Process -FilePath \$Emulator/);
 assert.match(helper,/sys\.boot_completed/);
 assert.match(helper,/SetForegroundWindow/);
 assert.match(helper,/A2S_Scola_Phone_Stable/);
});
test('UI168/PS03: PowerShell AST parser verifies syntax in CI if pwsh exists',t=>{
 const probe=spawnSync('pwsh',['-NoProfile','-NonInteractive','-Command','$PSVersionTable.PSVersion.Major'],{encoding:'utf8'});
 if(probe.error?.code==='ENOENT'){
  t.diagnostic('pwsh unavailable on this runner; user-side native parser command will be required.');
  return;
 }
 assert.equal(probe.status,0,probe.stderr);
 for(const path of [file,helperFile]){
  const escaped=path.replace(/'/g,"''");
  const cmd="$p='"+escaped+"';$t=$null;$e=$null;[System.Management.Automation.Language.Parser]::ParseFile($p,[ref]$t,[ref]$e)|Out-Null;foreach($x in $e){[Console]::Error.WriteLine($x.Message)};if($e.Count){exit 1}";
  const parsed=spawnSync('pwsh',['-NoProfile','-NonInteractive','-Command',cmd],{encoding:'utf8'});
  assert.equal(parsed.status,0,`${path}: ${parsed.stderr||parsed.stdout}`);
 }
});

test('UI168/PS04: emulator UI helper is ASCII and does not modify operational APK or database',()=>{
 assert.equal(Buffer.byteLength(helper,'utf8'),helper.length,'PowerShell launcher must remain ASCII-safe');
 assert.match(helper,/Get-AndroidDeviceState/);
 assert.match(helper,/getprop sys\.boot_completed/);
 assert.match(helper,/Get-Process -Name/);
 assert.match(helper,/Android Studio > Device Manager/);
 assert.match(helper,/localhost|127\.0\.0\.1/);
 assert.doesNotMatch(helper,/git\s+push|git\s+checkout|git\s+merge|gradle|kubectl/);
});
