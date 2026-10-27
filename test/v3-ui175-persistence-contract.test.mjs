import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {LocalAuditJournal} from '../mobile-session22/durable-journal.mjs';
async function setup(t){const dir=await mkdtemp(join(tmpdir(),'a2s-ui175-'));t.after(()=>rm(dir,{recursive:true,force:true}));return join(dir,'audit.ndjson');}
test('UI175/01: append and reload after restart preserves event order',async t=>{
 const path=await setup(t),first=new LocalAuditJournal(path);await first.load();
 await first.append({type:'TRIP_READY',actor:'AT-DEMO'});
 await first.append({type:'START',actor:'DR-DEMO'});
 const reopened=new LocalAuditJournal(path);const rows=await reopened.load();
 assert.equal(rows.length,2);assert.deepEqual(rows.map(x=>x.event.type),['TRIP_READY','START']);
});
test('UI175/02: changing a prior event is detected',async t=>{
 const path=await setup(t),j=new LocalAuditJournal(path);await j.load();
 await j.append({type:'START'});
 const raw=await readFile(path,'utf8');await writeFile(path,raw.replace('START','FINISH'));
 await assert.rejects(()=>new LocalAuditJournal(path).load(),/JOURNAL_INTEGRITY_FAILED/);
});
test('UI175/03: unsafe credentials and personal name keys are rejected',async t=>{
 const path=await setup(t),j=new LocalAuditJournal(path);await j.load();
 await assert.rejects(()=>j.append({type:'LOGIN',token:'secret'}),/SENSITIVE_FIELDS_DENIED/);
 await assert.rejects(()=>j.append({type:'PUPIL',studentName:'Test'}),/SENSITIVE_FIELDS_DENIED/);
 assert.equal(j.snapshot().length,0);
});
test('UI175/04: malformed persisted line refuses recovery',async t=>{
 const path=await setup(t);await writeFile(path,'{not json}\n');
 await assert.rejects(()=>new LocalAuditJournal(path).load(),/JOURNAL_CORRUPT/);
});
test.todo('UI175/REAL: protected append-only database with anchored audit digest and encrypted backups');
test.todo('UI175/REAL: durable identity/session storage and distributed revocation');
test.todo('UI175/REAL: offline synchronization protocol with conflicts, retries and physical-device validation');
