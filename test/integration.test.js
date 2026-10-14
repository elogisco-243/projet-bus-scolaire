
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { io: socketClient } = require('socket.io-client');
const { createTrackingServer } = require('../src/tracker');

const DRIVER_A = 'a'.repeat(64);
const DRIVER_B = 'b'.repeat(64);
const PARENT_A = 'c'.repeat(64);
const PARENT_B = 'd'.repeat(64);

function nextEvent(socket, event, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(event, received);
      reject(new Error(`Timeout: ${event}`));
    }, timeoutMs);

    function received(value) {
      clearTimeout(timeout);
      resolve(value);
    }

    socket.once(event, received);
  });
}

test('les flux GPS de deux bus restent isoles par role et autorisation', async () => {
  const accounts = [
    { token: DRIVER_A, role: 'driver', busIds: ['BUS_A'] },
    { token: DRIVER_B, role: 'driver', busIds: ['BUS_B'] },
    { token: PARENT_A, role: 'parent', busIds: ['BUS_A'] },
    { token: PARENT_B, role: 'parent', busIds: ['BUS_B'] }
  ];

  const { server, io } = createTrackingServer(accounts);

  await new Promise(resolve =>
    server.listen(0, '127.0.0.1', resolve)
  );

  const url = `http://127.0.0.1:${server.address().port}`;
  const sockets = [];

  const createClient = token => {
    const socket = socketClient(url, {
      transports: ['websocket'],
      reconnection: false,
      timeout: 3000,
      autoConnect: false,
      auth: { token }
    });

    sockets.push(socket);
    return socket;
  };

  const startClient = async token => {
    const socket = createClient(token);
    const connected = nextEvent(socket, 'connect');
    socket.connect();
    await connected;
    return socket;
  };

  try {
    // Test 1 : connexion sans autorisation
    const unknown = createClient('invalid-credential');
    const denied = nextEvent(unknown, 'connect_error');

    unknown.connect();
    assert.match((await denied).message, /UNAUTHORIZED/);

    // Test 2 : connexion des chauffeurs et parents
    const [driverA, driverB, parentA, parentB] =
      await Promise.all([
        startClient(DRIVER_A),
        startClient(DRIVER_B),
        startClient(PARENT_A),
        startClient(PARENT_B)
      ]);

    // Test 3 : parent B ne peut pas suivre bus A
    const wrongRoom = nextEvent(parentB, 'server:error');
    parentB.emit('parent:join_bus_room', { busId: 'BUS_A' });

    assert.equal((await wrongRoom).code, 'FORBIDDEN_BUS');

    // Test 4 : chaque parent rejoint son bus
    for (const [parent, busId] of [
      [parentA, 'BUS_A'],
      [parentB, 'BUS_B']
    ]) {
      const subscribed = nextEvent(parent, 'parent:subscribed');
      parent.emit('parent:join_bus_room', { busId });

      assert.equal((await subscribed).busId, busId);
    }

    const observedA = [];
    const observedB = [];

    parentA.on('parent:bus_location_update', value =>
      observedA.push(value)
    );

    parentB.on('parent:bus_location_update', value =>
      observedB.push(value)
    );

    // Test 5 : position GPS du bus A
    const gpsA = nextEvent(parentA, 'parent:bus_location_update');
    const ackA = nextEvent(driverA, 'driver:location_accepted');

    driverA.emit('driver:update_location', {
      bus_id: 'BUS_A',
      latitude: -1.6585,
      longitude: 29.2205
    });

    assert.equal((await gpsA).bus_id, 'BUS_A');
    await ackA;

    // Test 6 : position GPS du bus B
    const gpsB = nextEvent(parentB, 'parent:bus_location_update');
    const ackB = nextEvent(driverB, 'driver:location_accepted');

    driverB.emit('driver:update_location', {
      bus_id: 'BUS_B',
      latitude: -1.66,
      longitude: 29.23
    });

    assert.equal((await gpsB).bus_id, 'BUS_B');
    await ackB;

    // Test 7 : aucune fuite entre les deux bus
    await new Promise(resolve => setTimeout(resolve, 100));

    assert.deepEqual(
      observedA.map(position => position.bus_id),
      ['BUS_A']
    );

    assert.deepEqual(
      observedB.map(position => position.bus_id),
      ['BUS_B']
    );

    // Test 8 : parent interdit de transmettre le GPS
    const forbiddenWrite = nextEvent(parentA, 'server:error');

    parentA.emit('driver:update_location', {
      bus_id: 'BUS_A',
      latitude: -1.6,
      longitude: 29.2
    });

    assert.equal((await forbiddenWrite).code, 'FORBIDDEN');

    // Test 9 : chauffeur A interdit sur bus B
    const wrongBusWrite = nextEvent(driverA, 'server:error');

    driverA.emit('driver:update_location', {
      bus_id: 'BUS_B',
      latitude: -1.6,
      longitude: 29.2
    });

    assert.equal((await wrongBusWrite).code, 'FORBIDDEN_BUS');

    // Test 10 : parent A arrive après la transmission
    const lateParentA = await startClient(PARENT_A);
    const cachedA = nextEvent(
      lateParentA,
      'parent:bus_location_update'
    );

    lateParentA.emit('parent:join_bus_room', {
      busId: 'BUS_A'
    });

    assert.equal((await cachedA).bus_id, 'BUS_A');

    // Test 11 : parent B retrouve sa dernière position
    const lateParentB = await startClient(PARENT_B);
    const cachedB = nextEvent(
      lateParentB,
      'parent:bus_location_update'
    );

    lateParentB.emit('parent:join_bus_room', {
      busId: 'BUS_B'
    });

    assert.equal((await cachedB).bus_id, 'BUS_B');

  } finally {
    // Fermer les connexions après les tests
    for (const socket of sockets) socket.disconnect();

    await new Promise(resolve => io.close(resolve));
  }
});
