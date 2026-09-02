# LOTISEC Web V2.2 — architecture multi-acteurs

Nouvelle version du tableau de bord web géodécisionnel LOTISEC, conçue pour rester légère visuellement tout en couvrant le workflow opérationnel principal :

**Alerte mobile → validation humaine → affectation ambulance → routage → orientation hospitalière → suivi → bilan prévu/réalisé**

## Stack

- React.js + Vite
- Tailwind CSS
- MapLibre GL JS + OpenStreetMap
- Socket.IO client
- Export XLSX multi-feuilles
- Contrôle d’accès par rôles et journal d’audit
- Intégration backend prévue avec NestJS + TypeScript
- Données géospatiales côté backend prévues avec PostgreSQL + PostGIS
- Routage prévu via endpoint backend relié à OSRM

## Trois espaces séparés

La même architecture backend alimente trois interfaces distinctes. Le paramètre `espace` permet d’ouvrir directement chaque portail sans dupliquer les données ni le code métier :

- `?espace=operations&page=dashboard` : centre opérationnel, dispatch, carte et missions ;
- `?espace=health&page=health-dashboard` : professionnels de santé, admissions, capacités et transferts ;
- `?espace=national&page=national-dashboard` : ministères, territoires, performance et rapports décisionnels.

Les changements d’espace conservent le mode test et le flux réel dans deux états séparés. Les interfaces Santé et Pilotage ne reçoivent jamais de données nominatives de victimes.

## Menus du centre opérationnel

- Tableau de bord
- Alertes & incidents
- Interventions
- Carte opérationnelle
- Ambulances
- Hôpitaux & capacités
- Routage
- Orientation hospitalière
- Statistiques
- Bilans de mission
- Évaluation du prototype
- Journal de traçabilité
- État du système
- Sécurité & accès
- Fog & synchronisation
- Paramètres

## Données de démonstration

Les valeurs de distance, ETA, capacité, occupation, statistiques et états Fog fournies dans `src/data/demo.js` sont des données de démonstration. Elles doivent être remplacées par les données du backend en production.

Les hôpitaux intégrés dans la démonstration sont : CHU TOKOIN, CHU CAMPUS, CENTRE DE SANTÉ DE BÈ et DOGTA LAFIE.

Les opérateurs d'ambulances utilisés sont : Sapeurs-Pompiers, Secours ABALO, Togo Assistance et Multi Assistance Togo.

## Installation

```bash
npm install
cp .env.example .env
npm run dev
```

## Build

```bash
npm run build
```

## Intégration backend

La connexion mobile réelle est encapsulée dans `src/services/mobileGateway.js`. Le bac à sable test utilise un générateur séparé et conserve son propre état. Les incidents, positions GPS et capacités reçus depuis le terrain sont mis en attente tant que le mode test est actif.

Le contrat complet est documenté dans `MOBILE_INTEGRATION.md`. Les principaux champs de configuration se trouvent dans `.env.example`.

Le fichier `src/services/api.js` centralise les appels REST. Les routes prévues sont :

- `GET /api/dashboard`
- `GET /api/alerts`
- `POST /api/alerts/:id/validate`
- `GET /api/interventions`
- `GET /api/ambulances`
- `GET /api/hospitals`
- `GET /api/routing/compare?interventionId=...`
- `GET /api/hospitals/orientation?interventionId=...`
- `GET /api/fog/status`

Le dossier `src/pages` comprend également la supervision technique, la sécurité, les bilans de mission et l’export XLSX. Le fichier `requirements.txt` décrit l’environnement Python optionnel du service IA/XAI ; il n’est pas nécessaire pour exécuter le frontend React.

Les contrats propres aux nouveaux portails se trouvent dans `src/services/portalGateway.js`. Ils prévoient des namespaces Socket.IO et clients Keycloak indépendants : `lotisec-health-web` et `lotisec-national-web`.
