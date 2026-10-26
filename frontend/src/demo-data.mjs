// Données exclusivement synthétiques. Ne jamais copier de données d'enfants réels.
export const seed = {
  schools: [
    { id: 'SCH-A', name: 'École Horizon (fictive)', zone: 'Golf, Lubumbashi', active: true },
    { id: 'SCH-B', name: 'École Mwangaza (fictive)', zone: 'Kamalondo, Lubumbashi', active: true }
  ],
  operators: [
    { id: 'OP-A', name: 'Transport Kivu (fictif)', telephone: '+243 *** *** ***' },
    { id: 'OP-B', name: 'Navette Cuivre (fictive)', telephone: '+243 *** *** ***' }
  ],
  agreements: [
    { schoolId: 'SCH-A', operatorId: 'OP-A', active: true },
    { schoolId: 'SCH-B', operatorId: 'OP-B', active: true }
  ],
  drivers: [
    { id: 'DRV-A', ref: 'Chauffeur A', operatorId: 'OP-A', active: true },
    { id: 'DRV-B', ref: 'Chauffeur B', operatorId: 'OP-A', active: true },
    { id: 'DRV-C', ref: 'Chauffeur C', operatorId: 'OP-B', active: true }
  ],
  vehicles: [
    { id: 'BUS-A', code: 'LUB-014', seats: 24, operatorId: 'OP-A', status: 'disponible' },
    { id: 'BUS-B', code: 'LUB-028', seats: 18, operatorId: 'OP-A', status: 'disponible' },
    { id: 'BUS-C', code: 'LUB-031', seats: 30, operatorId: 'OP-B', status: 'disponible' }
  ],
  routes: [
    { id: 'ROU-A', name: 'Circuit Golf', schoolId: 'SCH-A', operatorId: 'OP-A', stops: ['Dépôt', 'Golf', 'Centre', 'École Horizon'] },
    { id: 'ROU-B', name: 'Circuit Centre', schoolId: 'SCH-A', operatorId: 'OP-A', stops: ['Dépôt', 'Centre', 'Météo', 'École Horizon'] },
    { id: 'ROU-C', name: 'Circuit Kamalondo', schoolId: 'SCH-B', operatorId: 'OP-B', stops: ['Dépôt', 'Kamalondo', 'Marché', 'École Mwangaza'] }
  ],
  trips: [
    { id: 'TRIP-A', routeId: 'ROU-A', vehicleId: 'BUS-A', driverId: 'DRV-A', status: 'planned', time: '06:45', eta: '07:35', progress: 0, publishedProgress: 0, boarded: [], lastStop: 'Dépôt' },
    { id: 'TRIP-B', routeId: 'ROU-B', vehicleId: 'BUS-B', driverId: 'DRV-B', status: 'planned', time: '06:55', eta: '07:45', progress: 0, publishedProgress: 0, boarded: [], lastStop: 'Dépôt' },
    { id: 'TRIP-C', routeId: 'ROU-C', vehicleId: 'BUS-C', driverId: 'DRV-C', status: 'in_progress', time: '06:40', eta: '07:30', progress: 50, publishedProgress: 50, boarded: ['ST-C'], lastStop: 'Kamalondo' }
  ],
  students: [
    { id: 'ST-A', ref: 'Élève A-01', schoolId: 'SCH-A', tripId: 'TRIP-A', parentId: 'PAR-A', absence: false },
    { id: 'ST-B', ref: 'Élève A-02', schoolId: 'SCH-A', tripId: 'TRIP-A', parentId: 'PAR-B', absence: false },
    { id: 'ST-D', ref: 'Élève A-03', schoolId: 'SCH-A', tripId: 'TRIP-B', parentId: 'PAR-B', absence: false },
    { id: 'ST-C', ref: 'Élève B-01', schoolId: 'SCH-B', tripId: 'TRIP-C', parentId: 'PAR-C', absence: false }
  ],
  verifiedLinks: [
    { parentId: 'PAR-A', studentId: 'ST-A', active: true },
    { parentId: 'PAR-B', studentId: 'ST-B', active: true },
    { parentId: 'PAR-B', studentId: 'ST-D', active: true },
    { parentId: 'PAR-C', studentId: 'ST-C', active: true }
  ],
  incidents: [
    { id: 'INC-1', tripId: 'TRIP-B', level: 'info', note: 'Vérification de la trousse de secours (simulation)', status: 'open' }
  ],
  notifications: [],
  outbox: [],
  nextId: 10,
  driverOnline: true,
  alertsEnabled: true,
  history: [{ id: 'EV-1', label: 'Jeu de données fictives initialisé', category: 'system' }]
};
