// Petit serveur de prévisualisation locale, indépendant du serveur V2 / Render.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const type = new Map([['.html','text/html; charset=utf-8'],['.css','text/css; charset=utf-8'],['.mjs','text/javascript; charset=utf-8'],['.js','text/javascript; charset=utf-8']]);

export async function handleRequest(req,res){
  try{
    if(req.method!=='GET'&&req.method!=='HEAD'){
      res.writeHead(405,{'allow':'GET, HEAD'});res.end();return;
    }
    const url = new URL(req.url,'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    if(pathname.includes('\\')||pathname.split('/').some(p=>p.startsWith('.'))){res.writeHead(403);res.end('Forbidden');return;}
    const target=resolve(root,pathname==='/'?'index.html':pathname.replace(/^\/+/,''));
    if(target!==resolve(root,'index.html')&&!target.startsWith(root+sep)){res.writeHead(403);res.end('Forbidden');return;}
    const mime=type.get(extname(target));
    if(!mime){res.writeHead(404);res.end('Not found');return;}
    const file=await readFile(target);
    res.writeHead(200,{
      'content-type':mime,'cache-control':'no-store',
      'x-content-type-options':'nosniff','referrer-policy':'no-referrer',
      'content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
    });
    res.end(req.method==='HEAD'?undefined:file);
  }catch(err){res.writeHead(err.code==='ENOENT'?404:400,{'content-type':'text/plain; charset=utf-8'});res.end('Page indisponible');}
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 const port=Number(process.env.DEMO_PORT??4173);
 if(!Number.isInteger(port)||port<1||port>65535)throw new Error('DEMO_PORT incorrect');
 createServer((req,res)=>{void handleRequest(req,res)}).listen(port,'127.0.0.1',()=>{
   console.log(`Bus V3 Lot 6 — maquette locale : http://127.0.0.1:${port}`);
   console.log('Les données restent en mémoire de ce navigateur. Aucune API distante.');
 });
}
