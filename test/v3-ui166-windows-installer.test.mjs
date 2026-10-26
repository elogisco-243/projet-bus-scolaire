import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const path=fileURLToPath(new URL('../scripts/qa-ui166-maniabilite-windows.ps1',import.meta.url));
const source=readFileSync(path,'utf8');

test('UI166/PS01: installer never targets Chauffeur or production',()=>{
 assert.match(source,/cd\.eneo360\.busscolaire\.v3\.sync09\.test/);
 assert.match(source,/A2S_Scola_Phone_Stable/);
 assert.match(source,/feature\/bus-v3-sync18-attendant-qa/);
 assert.match(source,/if \(\$ActualPackage -ne \$Package\)/);
 assert.match(source,/if \(\$Boot -ne "1" -or \$Api -ne "36"\)/);
 assert.match(source,/test\\v3-ui166-usability-scenarios\.test\.mjs/);
});
test('UI166/PS02: worksheet never fills in unobserved human usability scores',()=>{
 assert.match(source,/Fiche-maniabilite-UI166\.csv/);
 for(const n of [5,15,30,50])assert.match(source,new RegExp('ScenarioEleves='+n));
 for(const metric of ['IntervallePointageSecondes','TempsArretTotalSecondes','Defilements','Erreurs'])assert.match(source,new RegExp(metric+'=""'));
 assert.match(source,/aucun resultat utilisateur n est automatiquement valide/);
});
test('UI166/PS03: Windows PowerShell 5.1 can parse the BOM-less file as ANSI',()=>{
 // Guard the encoding regression that caused MissingEqualsInHashLiteral on Windows.
 assert.equal(Buffer.byteLength(source,'utf8'),source.length,'PS script must stay ASCII-only');
 assert.doesNotMatch(source,/MontéesPrevues|MontÃ©esPrevues/);
 assert.equal((source.match(/MonteesPrevues=/g)||[]).length,4);
 assert.equal((source.match(/\[pscustomobject\]@\{/g)||[]).length,4);
});
test('UI166/PS04: native PowerShell parser reports no syntax error on CI',t=>{
 const which=spawnSync('pwsh',['-NoProfile','-NonInteractive','-Command','$PSVersionTable.PSVersion.Major'],{encoding:'utf8'});
 if(which.error?.code==='ENOENT'){
  t.diagnostic('pwsh not installed on runner. Windows user command will parse natively before execution.');
  return;
 }
 assert.equal(which.status,0,'pwsh probe failed: '+which.stderr);
 const escaped=path.replace(/'/g,"''");
 const cmd="$f='"+escaped+"'; $tok=$null; $err=$null; [System.Management.Automation.Language.Parser]::ParseFile($f,[ref]$tok,[ref]$err) | Out-Null; foreach($x in $err) { [Console]::Error.WriteLine($x.Message) }; if($err.Count -gt 0) { exit 1 }";
 const parsed=spawnSync('pwsh',['-NoProfile','-NonInteractive','-Command',cmd],{encoding:'utf8'});
 assert.equal(parsed.status,0,'PowerShell parse errors: '+parsed.stderr+' '+parsed.stdout);
});
