export const hospitals = [
  { id: 'HSP-01', name: 'CHU TOKOIN', lat: 6.1378, lng: 1.2125, specialty: 'Traumatologie', beds: 5, occupancy: 78, eta: 9, status: 'Connecté', services:['Traumatologie','Imagerie','Réanimation'], lastCapacityUpdate:'il y a 18 s', reception:'Ouverte' },
  { id: 'HSP-02', name: 'CHU CAMPUS', lat: 6.1745, lng: 1.2154, specialty: 'Urgences polyvalentes', beds: 8, occupancy: 64, eta: 13, status: 'Connecté', services:['Urgences','Chirurgie','Laboratoire'], lastCapacityUpdate:'il y a 34 s', reception:'Ouverte' },
  { id: 'HSP-03', name: 'CENTRE DE SANTÉ DE BÈ', lat: 6.1321, lng: 1.2399, specialty: 'Urgences', beds: 3, occupancy: 86, eta: 15, status: 'Connecté', services:['Urgences','Soins intensifs'], lastCapacityUpdate:'il y a 1 min', reception:'Limitée' },
  { id: 'HSP-04', name: 'DOGTA LAFIE', lat: 6.1692, lng: 1.1765, specialty: 'Chirurgie / Urgences', beds: 7, occupancy: 58, eta: 17, status: 'Connecté', services:['Chirurgie','Urgences','Scanner'], lastCapacityUpdate:'il y a 46 s', reception:'Ouverte' },
]

export const ambulanceProviders = ['Sapeurs-Pompiers', 'Secours ABALO', 'Togo Assistance', 'Multi Assistance Togo']

export const ambulances = [
  { id:'AMB-07', provider:'Secours ABALO', status:'Disponible', lat:6.1456, lng:1.2120, updated:'il y a 20 s', eta:6, equipment:'Trauma', team:'2 secouristes', traffic:'Fluide' },
  { id:'AMB-03', provider:'Togo Assistance', status:'En route', lat:6.1299, lng:1.2310, updated:'il y a 35 s', eta:8, equipment:'Standard', team:'2 secouristes', traffic:'Modéré' },
  { id:'AMB-12', provider:'Sapeurs-Pompiers', status:'En intervention', lat:6.1581, lng:1.1960, updated:'il y a 1 min', eta:10, equipment:'Réanimation', team:'3 secouristes', traffic:'Dense' },
  { id:'AMB-05', provider:'Multi Assistance Togo', status:'Disponible', lat:6.1680, lng:1.2270, updated:'il y a 42 s', eta:11, equipment:'Standard', team:'2 secouristes', traffic:'Fluide' },
]

export const alerts = [
  { id:'ALT-2026-081', type:'Accident de la route', severity:'Critique', location:'Boulevard du 13 Janvier, Lomé', victims:2, source:'Application mobile', received:'il y a 2 min', lat:6.1414, lng:1.2187 },
  { id:'ALT-2026-080', type:'Collision moto', severity:'Élevée', location:'Tokoin, Lomé', victims:1, source:'Application mobile', received:'il y a 6 min', lat:6.1450, lng:1.2050 },
  { id:'ALT-2026-079', type:'Malaise', severity:'Modérée', location:'Bè, Lomé', victims:1, source:'Opérateur', received:'il y a 11 min', lat:6.1280, lng:1.2380 },
]

export const interventions = [
  { id:'INT-2026-0451', alertId:'ALT-2026-081', status:'En route', ambulance:'AMB-07', hospital:'CHU TOKOIN', eta:6, updated:'il y a 1 min' },
  { id:'INT-2026-0450', alertId:'ALT-2026-080', status:'Affectée', ambulance:'AMB-03', hospital:'CHU CAMPUS', eta:8, updated:'il y a 3 min' },
]

export const routes = [
  { id:'R1', label:'Itinéraire recommandé', distance:4.2, eta:8, traffic:'Fluide', recommended:true },
  { id:'R2', label:'Alternative 1', distance:3.7, eta:11, traffic:'Modéré', recommended:false },
  { id:'R3', label:'Alternative 2', distance:5.0, eta:13, traffic:'Dense', recommended:false },
]

export const fogStatus = {
  edge:'Terminaux actifs',
  fog:'Services locaux simulés',
  cloud:'Connecté',
  queue:3,
  lastSync:'il y a 18 s',
  connectivity:'Stable',
  services:[
    {name:'API NestJS', status:'Prêt à connecter'},
    {name:'Socket.IO', status:'Prêt à connecter'},
    {name:'PostgreSQL / PostGIS', status:'Via API métier'},
    {name:'OSRM', status:'Routage actif'},
  ]
}
