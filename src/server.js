'use strict';
const {loadConfig,createTrackingServer}=require('./tracker');
try {
  const {accounts,port,host}=loadConfig();
  const {server,io}=createTrackingServer(accounts);
  server.listen(port,host,()=>console.log(`Bus v2: http://${host}:${port}`));
  server.on('error',err=>{console.error(err.message);process.exitCode=1;});
  for (const sig of ['SIGINT','SIGTERM']) process.once(sig,()=>io.close(()=>process.exit(0)));
} catch(err) {console.error('Configuration:',err.message);process.exitCode=1;}
