# Contrat d’intégration mobile ↔ backend ↔ web LOTISEC

## Architecture cible

L’application mobile ne doit pas communiquer directement avec le navigateur de l’opérateur. Elle transmet le signalement au backend NestJS. Le backend valide les données, les persiste dans PostgreSQL/PostGIS, puis diffuse l’événement via Socket.IO. Cette séparation permet l’authentification, la traçabilité, le dédoublonnage et la reprise après une coupure réseau.

```text
Application mobile → API NestJS → PostgreSQL/PostGIS → Socket.IO → Plateforme web
```

Le module `src/services/mobileGateway.js` contient le contrat exécutable : configuration, normalisation, accusé de réception, positions GPS, capacités hospitalières et reconnexion. Le simulateur utilise `createTestIncident()` et ne réutilise jamais la connexion réelle.

## Variables de la plateforme web

```env
VITE_OPERATION_MODE=test
VITE_API_URL=https://api.exemple.tld/api
VITE_SOCKET_URL=https://api.exemple.tld
VITE_SOCKET_PATH=/socket.io
VITE_MOBILE_NAMESPACE=/operations
VITE_HEALTH_NAMESPACE=/health-network
VITE_NATIONAL_NAMESPACE=/national-pilotage
VITE_MOBILE_TENANT_ID=lotisec-togo
VITE_HEALTH_PATH=/health
VITE_MOBILE_INCIDENT_EVENTS=incident:created,incident:new
VITE_MOBILE_POSITION_EVENTS=ambulance:position,gps:update,vehicle:position
VITE_HEALTH_CENTER_EVENTS=hospital:capacity,health-center:capacity
VITE_MOBILE_ACK_EVENT=incident:web:ack
VITE_KEYCLOAK_URL=https://auth.exemple.tld
VITE_KEYCLOAK_REALM=lotisec
VITE_KEYCLOAK_CLIENT_ID=lotisec-operator-web
VITE_KEYCLOAK_HEALTH_CLIENT_ID=lotisec-health-web
VITE_KEYCLOAK_NATIONAL_CLIENT_ID=lotisec-national-web
VITE_KEYCLOAK_HEALTH_ROLE=health_professional
VITE_KEYCLOAK_NATIONAL_ROLE=national_analyst
VITE_OSRM_URL=https://router.project-osrm.org
VITE_ENABLE_DEMO_FALLBACK=true
```

Le backend doit autoriser l’origine publique de la plateforme dans sa configuration CORS et accepter les transports Socket.IO `websocket` et `polling`.

## Séparation des trois portails

| Portail | Namespace | Client Keycloak | Périmètre |
|---|---|---|---|
| Centre opérationnel | `/operations` | `lotisec-operator-web` | Incidents, ambulances, missions et orientation |
| Professionnels de santé | `/health-network` | `lotisec-health-web` | Admissions anonymisées, capacités et transferts |
| Pilotage national | `/national-pilotage` | `lotisec-national-web` | Agrégats, performance, qualité et rapports |

Le backend reste la source d’autorité. Il vérifie le rôle du jeton Keycloak avant de rejoindre un namespace et filtre les événements selon le périmètre. Le portail national ne reçoit ni identité, ni téléphone, ni média de victime.

Événements complémentaires prévus : `hospital:admission:decision`, `mission:arrival:expected`, `mission:handover:update`, `national:indicator:update`, `national:data-quality:alert` et `national:report:generated`.

## Signalement mobile normalisé

Le backend peut accepter des noms de champs adaptés au mobile, mais il doit diffuser au minimum cette structure :

```json
{
  "id": "INC-2026-000123",
  "type": "Collision routière",
  "severity": "Critique",
  "latitude": 6.1639,
  "longitude": 1.2058,
  "accuracy": 6,
  "address": "Carrefour GTA, Lomé",
  "victims": 2,
  "vehicles": 2,
  "timestamp": "2026-08-31T18:03:00.000Z",
  "schemaVersion": "1.0",
  "correlationId": "5f371b8f-6402-4b4f-93ce-3fe4084abc10",
  "deviceId": "android-2f81a",
  "reporterReference": "ANON-7C91",
  "mediaCount": 1
}
```

Règles recommandées :

- `id` est stable et unique afin d’éviter les doublons lors d’une retransmission mobile ;
- latitude et longitude sont des nombres et doivent être validées côté backend ;
- `timestamp` est au format ISO 8601 UTC ;
- les données sensibles sont filtrées avant diffusion aux postes opérateurs ;
- `correlationId` relie la requête mobile, l’enregistrement backend et l’accusé web ;
- `schemaVersion` permet de faire évoluer le contrat sans casser les anciennes applications ;
- `reporterReference` doit être pseudonymisée : le nom et le téléphone ne sont pas diffusés au navigateur ;
- le backend enregistre l’incident avant de diffuser `incident:new`.

## Séparation stricte réel / test

1. `VITE_OPERATION_MODE=test` charge uniquement le bac à sable.
2. Le client réel peut rester connecté, mais ses messages sont placés dans `realEventQueue`.
3. Ces messages ne modifient ni la carte, ni les missions, ni les statistiques de test.
4. Le passage explicite en mode réel sauvegarde l’état du test, restaure l’espace réel et traite la file terrain.
5. Le retour au mode test restaure exactement l’état du bac à sable.
6. Le lancement du scénario guidé force toujours l’environnement test.

## Événements entrants vers le web

| Événement | Producteur backend | Effet dans la plateforme |
|---|---|---|
| `incident:new` | Service incidents | Ajout ou mise à jour, son, zoom, journal, Fog et statistiques |
| `ambulance:position` | Service GPS | Déplacement de l’ambulance sur la carte |
| `hospital:capacity` | Service hôpitaux | Capacité actualisée et nouveau classement |

Alias déjà tolérés : `incident:created`, `alert:new`, `emergency:new`, `sos:new`, `gps:update`, `vehicle:position` et `health-center:capacity`.

## Événements sortants du web

| Événement | Moment | Données principales |
|---|---|---|
| `web:operator:ready` | Connexion du poste | Client et capacités actives |
| `incident:web:ack` | Réception d’un incident | Incident, état `received`, horodatage |
| `incident:status:update` | Validation ou rejet | Incident, statut, opérateur |
| `mission:created` | Affectation | Mission, ambulance, incident, hôpital recommandé |
| `mission:status:update` | Progression | Mission, ambulance, nouveau statut |
| `mission:rerouted` | Congestion | Mission, numéro de reroutage, motif |
| `mission:orientation` | Hôpital confirmé | Mission, hôpital, places disponibles |
| `hospital:capacity:update` | Saisie opérateur | Hôpital et nouvelle capacité |

Tous les événements sortants sensibles incluent `operatorId`, `operatorRole`, `emittedAt`, `source` et `tenantId`. Le backend doit recalculer les autorisations depuis le jeton Keycloak et ne jamais faire confiance au rôle envoyé par le navigateur.

Le backend doit persister ces changements puis les rediffuser aux clients autorisés, notamment au mobile du déclarant et aux terminaux terrain.

## Reconnexion, dédoublonnage et reprise

1. Le client Socket.IO se reconnecte automatiquement.
2. Un incident déjà connu est fusionné par son identifiant sans rejouer l’alarme.
3. Chaque nouvelle réception produit `incident:web:ack`.
4. En connectivité dégradée, la file Fog locale conserve les événements.
5. Au retour du réseau, le backend acquitte la synchronisation avant suppression locale.

## Vérification minimale avec le développeur mobile

1. Envoyer un incident depuis un téléphone réel.
2. Vérifier sa persistance PostGIS et la diffusion `incident:new`.
3. Vérifier le ciblage cartographique, le son et l’incrément des statistiques.
4. Affecter une ambulance et observer `mission:created` côté backend/mobile.
5. Émettre plusieurs `ambulance:position` et vérifier le déplacement continu.
6. Mettre à jour une capacité avec `hospital:capacity` et vérifier le reclassement.
7. Couper puis rétablir le réseau pour vérifier la reprise sans doublon.
8. Laisser le web en mode test, envoyer un incident réel et vérifier qu’il reste isolé.
9. Activer le flux réel et vérifier l’import de la file sans modifier le scénario sauvegardé.
10. Comparer le bilan prévu/réalisé et le journal d’audit après clôture.
