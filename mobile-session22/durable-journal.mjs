/** UI-175: LOCAL DEVELOPMENT file journal, not a production datastore.
 * Append-only records with SHA-256 hash chaining, replay and integrity checks.
 * Not tamper-proof against an attacker who can rewrite the entire file.
 * No student PII, real credentials, tokens or sensitive operational data.
 */
import {open,readFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
const digest=v=>createHash('sha256').update(v).digest('hex');
const serial=v=>JSON.stringify(v);
export class LocalAuditJournal {
 constructor(path){if(typeof path!=='string'||!path)throw Error('PATH_REQUIRED');this.path=path;this.entries=[];this.initialized=false;}
 async load(){
  let raw='';
  try{raw=await readFile(this.path,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
  const lines=raw.split('\n').filter(Boolean);let last='GENESIS',entries=[];
  for(const [index,line] of lines.entries()){
   let row;try{row=JSON.parse(line)}catch{throw Error('JOURNAL_CORRUPT');}
   if(row.index!==index+1||row.prev!==last||
      row.hash!==digest(serial({index:row.index,prev:row.prev,event:row.event})))
    throw Error('JOURNAL_INTEGRITY_FAILED');
   entries.push(row);last=row.hash;
  }
  this.entries=entries;this.initialized=true;return this.snapshot();
 }
 async append(event){
  if(!this.initialized)throw Error('LOAD_REQUIRED');
  if(!event||typeof event!=='object'||Array.isArray(event))throw Error('INVALID_EVENT');
  if(['password','token','secret','studentName'].some(k=>Object.hasOwn(event,k)))
    throw Error('SENSITIVE_FIELDS_DENIED');
  const last=this.entries.at(-1)?.hash||'GENESIS';
  const row={index:this.entries.length+1,prev:last,event:structuredClone(event)};
  row.hash=digest(serial(row));
  await mkdir(dirname(this.path),{recursive:true});
  const handle=await open(this.path,'a',0o600);
  try{await handle.writeFile(serial(row)+'\n');await handle.sync();}finally{await handle.close();}
  this.entries.push(row);return {...row};
 }
 snapshot(){if(!this.initialized)throw Error('LOAD_REQUIRED');return this.entries.map(x=>structuredClone(x));}
}
