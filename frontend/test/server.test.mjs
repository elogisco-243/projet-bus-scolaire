import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { handleRequest } from '../server.mjs';
async function request(path,method='GET'){
 const server=createServer((req,res)=>void handleRequest(req,res));
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 try{const response=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{method});return {status:response.status,type:response.headers.get('content-type'),text:await response.text(),headers:response.headers}}finally{await new Promise(done=>server.close(done));}
}
test('serve index HTML et modules ESM avec types exacts',async()=>{
 const html=await request('/');assert.equal(html.status,200);assert.match(html.text,/Bus scolaire V3/);
 assert.match(html.headers.get('content-security-policy'),/connect-src 'none'/);
 const js=await request('/src/app.mjs');assert.equal(js.status,200);assert.match(js.type,/javascript/);
 const css=await request('/styles.css');assert.equal(css.status,200);assert.match(css.type,/text\/css/);
});
test('aucune route API ni fichier privé exposé',async()=>{
 assert.equal((await request('/api/v3/trips')).status,404);
 assert.equal((await request('/src/.env')).status,403);
 assert.equal((await request('/does-not-exist')).status,404);
});
test('méthodes non autorisées rejetées',async()=>{
 assert.equal((await request('/','POST')).status,405);
});
