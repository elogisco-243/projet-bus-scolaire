const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const ioClient = require('socket.io-client');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;
let latestBusPosition = { lat: -1.6585, lng: 29.2205 };

io.on('connection', (socket) => {
  socket.on('driver:update_location', (data) => {
    latestBusPosition = { lat: data.latitude, lng: data.longitude };
    console.log(`[📡 SERVEUR GPS] Position du Bus ${data.bus_id} reçue -> Lat: ${data.latitude.toFixed(4)}, Lng: ${data.longitude.toFixed(4)}`);
    io.emit('parent:bus_location_update', data);
  });

  socket.on('parent:join_bus_room', (data) => {
    socket.emit('parent:bus_location_update', {
      bus_id: data.busId,
      latitude: latestBusPosition.lat,
      longitude: latestBusPosition.lng,
      timestamp: new Date().toISOString()
    });
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Serveur de simulation démarré !`);
  setTimeout(startDriverSimulation, 1500);
  setTimeout(startParentSimulation, 2000);
});

function startDriverSimulation() {
  console.log("\n--- [SIMULATION] Le bus démarre sa tournée ---");
  const driverSocket = ioClient(`http://localhost:${PORT}`);
  let simulatedLat = -1.6585;
  let simulatedLng = 29.2205;

  setInterval(() => {
    simulatedLat += 0.0005;
    simulatedLng += 0.0002;
    driverSocket.emit('driver:update_location', {
      bus_id: 'BUS_LIGNE_4',
      latitude: simulatedLat,
      longitude: simulatedLng,
      timestamp: new Date().toISOString()
    });
  }, 3000);
}

function startParentSimulation() {
  console.log("--- [SIMULATION] L'application parent écoute ---");
  const parentSocket = ioClient(`http://localhost:${PORT}`);
  parentSocket.on('connect', () => {
    parentSocket.emit('parent:join_bus_room', { busId: 'BUS_LIGNE_4' });
  });
  parentSocket.on('parent:bus_location_update', (data) => {
    console.log(`[📱 ÉCRAN PARENT] Le bus avance en direct -> Lat: ${data.latitude.toFixed(4)}, Lng: ${data.longitude.toFixed(4)}`);
  });
}