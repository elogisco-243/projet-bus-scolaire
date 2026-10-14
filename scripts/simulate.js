'use strict';
const {io}=require('socket.io-client');
const driverToken=process.env.SIM_DRIVER_TOKEN;
const parentToken=process.env.SIM_PARENT_TOKEN;
if (!driverToken || !parentToken || [driverToken,parentToken].some(t=>t.includes('REPLACE_ME'))) {
  console.error('Configurer SIM_DRIVER_TOKEN et SIM_PARENT_TOKEN dans .env'); process.exit(1);
}
const busId=process.env.SIM_BUS_ID||'BUS_LIGNE_4';
const url=`http://${process.env.HOST||'127.0.0.1'}:${process.env.PORT||3000}`;
const options={transports:['websocket'],reconnection:false};
const driver=io(url,{...options,auth:{token:driverToken}});
const parent=io(url,{...options,auth:{token:parentToken}});
let lat=-1.6585,lng=29.2205,timer;
for (const socket of [driver,parent]) {
  socket.on('connect_error',e=>console.error('Connexion:',e.message));
  socket.on('server:error',e=>console.error('Serveur:',e.code));
}
parent.on('connect',()=>parent.emit('parent:join_bus_room',{busId}));
parent.on('parent:bus_location_update',p=>console.log('Parent:',p.bus_id,p.latitude,p.longitude,p.timestamp));
driver.on('connect',()=>{
  console.log('Simulation du bus',busId);
  timer=setInterval(()=>{
    lat+=0.0005;lng+=0.0002;
    driver.emit('driver:update_location',{bus_id:busId,latitude:lat,longitude:lng,timestamp:new Date().toISOString()});
  },3000);
});
for (const sig of ['SIGINT','SIGTERM']) process.once(sig,()=>{clearInterval(timer);driver.close();parent.close();process.exit(0);});
