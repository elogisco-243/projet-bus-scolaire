import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const file=fileURLToPath(new URL('../scripts/qa-ui165-recette-windows.ps1',import.meta.url));
const source=readFileSync(file,'utf8');

test('UI165/PS01: both capture prompts use complete, valid skip conditions',()=>{
 assert.match(source,/if \(\$AtStop -ne 'S' -and \$AtStop -ne 's'\) \{/);
 assert.match(source,/if \(\$AtTerminus -ne 'S' -and \$AtTerminus -ne 's'\) \{/);
 assert.doesNotMatch(source,/-notmatch '\^\[Ss\]\s*$/m);
 assert.doesNotMatch(source,/\n\) \{/);
});

test('UI165/PS02: the isolated host/package/AVD guards remain mandatory',()=>{
 assert.match(source,/feature\/bus-v3-sync18-attendant-qa/);
 assert.match(source,/cd\.eneo360\.busscolaire\.v3\.sync09\.test/);
 assert.match(source,/A2S_Scola_Phone_Stable/);
 assert.match(source,/if \(\$ActualPackage -ne \$Package\)/);
 assert.match(source,/if \(\$Boot -ne "1" -or \$Api -ne "36"\)/);
 assert.match(source,/test\\v3-ui165-final-usability-recipe\.test\.mjs/);
});

test('UI165/PS03: no unclosed quotes and balanced code delimiters',()=>{
 const stack=[],opening=new Map([['(',')'],['[',']'],['{','}']]);
 let mode='code',line=1;
 for(let i=0;i<source.length;i++){
  const ch=source[i],next=source[i+1];
  if(ch==='\n')line++;
  if(mode==='comment'){if(ch==='\n')mode='code';continue;}
  if(mode==='single'){
   if(ch==="'"&&next==="'"){i++;continue;}
   if(ch==="'")mode='code';
   continue;
  }
  if(mode==='double'){
   if(ch===String.fromCharCode(96)){i++;continue;}
   if(ch==='"')mode='code';
   continue;
  }
  if(ch==='#'){mode='comment';continue;}
  if(ch==="'"){mode='single';continue;}
  if(ch==='"'){mode='double';continue;}
  if(opening.has(ch)){stack.push({close:opening.get(ch),line});continue;}
  if(')]}'.includes(ch)){
   const entry=stack.pop();
   assert.ok(entry,'unexpected '+ch+' at '+line);
   assert.equal(ch,entry.close,'mismatched delimiter at '+line+' (opened line '+entry.line+')');
  }
 }
 assert.ok(['code','comment'].includes(mode),'unterminated '+mode+' quotation');
 assert.equal(stack.length,0,'unclosed blocks: '+JSON.stringify(stack));
 assert.match(source,/\n\}\s*$/);
});

test('UI165/PS04: PowerShell AST parser accepts script if pwsh is available on CI',t=>{
 const probe=spawnSync('pwsh',['-NoProfile','-NonInteractive','-Command','$PSVersionTable.PSVersion.Major'],{encoding:'utf8'});
 if(probe.error?.code==='ENOENT'){t.diagnostic('Native parser unavailable; Windows preflight will use its local native PowerShell AST parser.');return;}
 assert.equal(probe.status,0,'pwsh probe failed: '+probe.stderr);
 const escaped=file.replace(/'/g,"''");
 const cmd="$f='"+escaped+"'; $t=$null; $e=$null; [System.Management.Automation.Language.Parser]::ParseFile($f,[ref]$t,[ref]$e) | Out-Null; foreach($item in $e) { [Console]::Error.WriteLine($item.Message) }; if ($e.Count -ne 0) { exit 1 }";
 const parsed=spawnSync('pwsh',['-NoProfile','-NonInteractive','-Command',cmd],{encoding:'utf8'});
 assert.equal(parsed.status,0,'PowerShell AST parsing failed: '+parsed.stderr+'\n'+parsed.stdout);
});
