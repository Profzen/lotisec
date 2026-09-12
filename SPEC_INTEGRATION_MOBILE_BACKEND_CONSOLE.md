# memoire.md — LOTISEC
## Directive de mise à niveau intégrale Mobile App ↔ Portail mobile Web ↔ Backend ↔ Console

**Date de cadrage : 11 septembre 2026**  
**Dépôt de référence : `Profzen/lotisec` — branche `main`**  
**Objectif de ce document :** servir de cahier d’exécution technique à l’agent IA de développement.  
Il faut considérer ce document comme une **directive d’implémentation de bout en bout**, et non comme une simple liste d’idées.

---

# 1. Objectif global

Mettre LOTISEC dans un état cohérent où :

1. l’application mobile native `Qr-mobile/`;
2. le portail citoyen Web mobile `frontend/`;
3. le backend `backend/`;
4. la console opérationnelle `LOTISEC-Console-Complete/`;

échangent les **mêmes informations**, avec les **mêmes règles métier**, les **mêmes statuts**, et sans valeurs fictives présentées comme réelles.

Le parcours prioritaire à fiabiliser est :

```text
Citoyen / témoin
      ↓
Application mobile OU portail mobile Web
      ↓
Signalement SOS géolocalisé
      ↓
Backend Express / PostgreSQL-PostGIS
      ↓
Console opérationnelle
      ↓
Validation humaine
      ↓
Affectation réelle d’une unité
      ↓
Suivi de l’intervention
      ↓
Retour d’état vers le déclarant
```

Le second parcours à fiabiliser est :

```text
Passager LOTISEC Zem
      ↓
Choix départ / destination
      ↓
Recherche d’un conducteur proche
      ↓
Offre privée au conducteur
      ↓
Acceptation
      ↓
Approche → prise en charge → trajet → fin
      ↓
Suivi cartographique cohérent Web / APK
```

---

# 2. Règles absolues

## 2.1 Ne pas casser la console existante

La console V3.x contient déjà :
- son design actuel ;
- le mode test guidé ;
- les 8 étapes de démonstration ;
- les sons et gardes anti-bips ;
- les écrans santé et pilotage national ;
- les composants cartographiques existants ;
- la séparation `test` / `real`.

**Ne pas refaire son UI.**  
Les corrections doivent porter sur la **connexion réelle**, la **persistence**, la **normalisation des données**, et la **cohérence métier**.

## 2.2 Une valeur inconnue ne doit jamais être inventée

Interdictions :
- faux GPS présenté comme GPS réel ;
- `1 victime` si personne ne l’a déclaré ;
- `1 véhicule` parce que `0` est falsy ;
- gravité `critical` imposée à tous les SOS ;
- unité ou hôpital fictif présenté comme affecté ;
- statut local différent du statut backend ;
- annulation seulement visuelle.

## 2.3 Le backend est la source d’autorité

En mode réel :
- le mobile envoie ;
- le backend valide et persiste ;
- la console lit et agit via le backend ;
- les changements opérationnels doivent être persistés ;
- les interfaces ne doivent pas fabriquer localement un état opérationnel non enregistré.

## 2.4 Ne pas compliquer le SOS

Le SOS doit rester utilisable sous stress.

Le principe cible est :

```text
1. Déclencher rapidement
2. Envoyer la position
3. Confirmer la réception
4. Proposer ensuite un complément facultatif de 10 secondes
```

---

# 3. État réel du code à la date de l’audit

## 3.1 Backend réellement utilisé

Le backend opérationnel du dépôt est **Express + TypeScript**, avec notamment :
- `express`
- `pg`
- `ws`
- `zod`

Chemin principal :
`backend/src/routers/operations.ts`

Le mémoire et certains documents techniques parlent encore de **NestJS**.  
Cela devra être corrigé après stabilisation du code.

## 3.2 Temps réel réellement utilisé

Le backend utilise un **WebSocket natif** (`ws`) et la console possède également un mécanisme de **polling REST** sur `/api/v1/incidents`.

Ne pas documenter l’architecture finale comme si le runtime réel était intégralement basé sur Socket.IO si ce n’est pas le cas.

## 3.3 Création actuelle d’un incident

Endpoint :

```http
POST /api/v1/incidents
```

Le backend accepte actuellement :

```text
source
type
severity
latitude
longitude
accuracy
address
victims
vehicles
vehicle_type
description
requested_service
flags
qr_token
client_event_id
```

Le score de priorité utilise actuellement :
- gravité ;
- nombre de victimes ;
- nombre de véhicules ;
- flags.

## 3.4 Données actuellement envoyées par l’APK

Dans `Qr-mobile/src/screens/HomeScreen.tsx`, le SOS principal envoie actuellement des valeurs fixes :

```text
type = "SOS citoyen"
severity = "critical"
victims = 1
vehicles = 0
address = "Position GPS certifiée"
```

Ceci doit être corrigé.

## 3.5 Données actuellement envoyées par le Web citoyen

Dans `frontend/src/pages/Home.tsx`, le SOS Web envoie pratiquement les mêmes valeurs fixes :

```text
type = "SOS citoyen"
severity = "critical"
victims = 1
vehicles = 0
address = "Position GPS web"
```

Le comportement final doit être identique fonctionnellement entre Web et APK.

---

# 4. Problème critique GPS à corriger

## 4.1 APK

Le code mobile initialise actuellement un fallback :

```text
latitude = 6.1375
longitude = 1.2125
accuracy = 10
```

Si la permission GPS est refusée ou si l’acquisition échoue, ces coordonnées peuvent être utilisées.

**À supprimer pour le SOS.**

### Comportement obligatoire

```text
GPS autorisé + position obtenue
    → envoyer la vraie position

GPS autorisé mais acquisition impossible
    → réessayer brièvement
    → éventuellement proposer une dernière position connue,
      mais elle doit être explicitement marquée comme approximative

GPS refusé / aucune position exploitable
    → ne jamais envoyer des coordonnées fictives
    → proposer :
       - Réessayer
       - Saisir un repère / choisir un point sur la carte
       - Appeler le 118
```

Le message `Position GPS certifiée` ne doit être utilisé que si la position est effectivement issue du GPS.

## 4.2 Web citoyen

Le Web bloque actuellement le SOS lorsque la géolocalisation échoue, ce qui est plus honnête que le faux fallback.

Il faut toutefois proposer une issue simple :
- Réessayer le GPS ;
- choisir un point sur la carte ;
- renseigner un repère ;
- appeler le 118.

---

# 5. Nouveau flux SOS cible

## 5.1 Étape A — déclenchement

Bouton SOS → confirmation unique.

Texte recommandé :

> Votre alerte et votre position seront transmises au centre de supervision LOTISEC pour prise en charge.

Ne plus afficher avant réponse serveur :

> une ambulance sera automatiquement dépêchée

sauf si le backend confirme réellement une affectation.

## 5.2 Étape B — acquisition de la position

Collecter automatiquement :
- latitude ;
- longitude ;
- précision GPS ;
- source de la position ;
- date locale pour affichage si nécessaire.

Le serveur doit rester la référence pour `created_at`.

## 5.3 Étape C — incident minimal envoyé immédiatement

Payload minimal recommandé :

```json
{
  "source": "mobile",
  "type": "Urgence routière",
  "severity": "unknown",
  "latitude": 6.0000,
  "longitude": 1.0000,
  "accuracy": 8,
  "victims": 0,
  "vehicles": 0,
  "flags": [
    "details_pending",
    "victims_unknown",
    "vehicles_unknown"
  ],
  "qr_token": "si disponible",
  "client_event_id": "identifiant stable généré côté client"
}
```

Pour le Web :

```json
{
  "source": "web",
  "...": "même contrat fonctionnel"
}
```

### Important

`victims = 0` et `vehicles = 0` ne doivent pas être affichés comme des faits si les flags indiquent que l’information est inconnue.

La console devra afficher :

```text
Victimes : Non renseigné
Véhicules : Non renseigné
```

## 5.4 Étape D — accusé de réception serveur

Après `HTTP 201` :

```text
Alerte reçue par LOTISEC
Localisation transmise
En attente de validation
```

Stocker localement :
- `incident.id`
- `client_event_id`
- statut reçu
- date d’envoi

## 5.5 Étape E — complément facultatif

Après réception :

> Votre alerte a été transmise. Pouvez-vous nous donner quelques informations supplémentaires ?

Boutons :

```text
Compléter l’alerte
Plus tard
```

Le complément doit rester court.

---

# 6. Écran "Compléter l’alerte"

Créer le même parcours sur :
- `Qr-mobile`
- `frontend`

## 6.1 Type d’urgence

Choix simples :

```text
Accident routier
Malaise / urgence médicale
Incendie / véhicule en feu
Autre urgence
```

Éviter une taxonomie trop longue.

## 6.2 Nombre de victimes

Choix rapide :

```text
1
2
3+
Je ne sais pas
```

Si `Je ne sais pas` :
- conserver `victims_unknown`.

Sinon :
- retirer `victims_unknown`.

## 6.3 Dangers observables

Multi-sélection facultative :

```text
Personne inconsciente
Saignement important
Personne coincée
Feu / fumée
Voie bloquée
Autre danger
```

Ces valeurs alimentent `flags`.

Ne pas demander à l’utilisateur de diagnostiquer médicalement une gravité.

## 6.4 Véhicules impliqués

Afficher cette question seulement si l’événement est routier.

Choix :

```text
1
2
3+
Je ne sais pas
```

Ajouter éventuellement :

```text
Moto
Voiture
Camion / bus
Mixte
```

dans `vehicle_type`.

## 6.5 Description

Champ facultatif très court :

```text
Ajouter une précision
```

Pas obligatoire pour envoyer l’urgence.

---

# 7. Gravité et score de priorité

## 7.1 Ne plus forcer `critical`

Le mobile et le Web ne doivent plus envoyer systématiquement :

```text
severity = critical
```

## 7.2 Valeur initiale

Envoyer :

```text
severity = unknown
```

## 7.3 Évaluation

Le backend peut recalculer une gravité/ priorité indicative à partir de :
- nombre de victimes ;
- dangers observés ;
- type d’incident ;
- véhicules impliqués.

L’opérateur conserve la validation humaine.

La console doit afficher :

```text
À évaluer
```

pour `unknown`.

Ne pas transformer `unknown` en `Critique` par défaut.

---

# 8. Endpoint d’enrichissement d’un incident

Ajouter un endpoint backend dédié :

```http
PATCH /api/v1/incidents/:id/report
```

ou nom équivalent clair.

Il doit permettre au déclarant autorisé de compléter uniquement :

```text
type
victims
vehicles
vehicle_type
description
flags
requested_service
```

Il doit :
1. vérifier que le déclarant est autorisé à compléter cet incident ;
2. mettre à jour le même incident ;
3. recalculer le score de priorité ;
4. retirer `details_pending` lorsque le complément est terminé ;
5. écrire un `incident_event`;
6. diffuser une mise à jour ;
7. ne pas créer une seconde alerte dans la console.

La console doit **fusionner** la mise à jour par `incident.id`.

Aucun nouveau bip ne doit être joué pour une simple mise à jour du même incident.

---

# 9. Dédoublonnage et `client_event_id`

`client_event_id` doit être généré **avant le premier envoi** et rester identique lors de toute retransmission du même SOS.

Exemples :

```text
mobile-<user-or-anon>-<uuid>
web-<user-or-anon>-<uuid>
```

Le comportement backend doit être idempotent.

Actuellement le `ON CONFLICT(client_event_id)` ne met pas réellement à jour les autres informations.

À corriger :
- même événement = même incident ;
- enrichissement = PATCH ;
- retransmission réseau = pas de doublon.

---

# 10. Connectivité dégradée

## 10.1 APK

Créer une vraie file locale persistante avec AsyncStorage :

```text
pending_incidents
```

Chaque item :

```json
{
  "client_event_id": "...",
  "payload": {},
  "created_at": "...",
  "attempts": 0,
  "state": "pending"
}
```

Flux :

```text
création SOS
→ sauvegarde locale
→ tentative API
→ succès : ack + suppression de la file
→ échec : state=pending
→ reprise réseau : nouvel envoi du même client_event_id
```

États visibles :

```text
Transmission en cours
En attente de réseau
Alerte transmise
Échec définitif / Réessayer
```

## 10.2 Web mobile

Utiliser :
- IndexedDB de préférence ;
- localStorage uniquement si nécessaire.

Même contrat de reprise et même `client_event_id`.

---

# 11. Annulation d’un SOS

Actuellement l’APK et le Web annulent principalement l’état visuel local.

Cela est insuffisant.

Créer une action serveur :

```http
PATCH /api/v1/incidents/:id/status
{
  "status": "cancelled"
}
```

Pour le déclarant, prévoir une route ou une permission limitée lui permettant d’annuler **son propre incident** tant que cela reste autorisé.

L’interface doit demander :

> Confirmer l’annulation de ce signalement ?

Après confirmation serveur :

```text
Alerte annulée
```

La console doit être mise à jour.

---

# 12. Retour d’état vers le citoyen

Le mobile doit distinguer :

```text
Transmis
Reçu par LOTISEC
Validé
Unité affectée
En route
Pris en charge / clôturé
Annulé / rejeté
```

Ne pas afficher un état opérationnel avant de l’avoir reçu du backend.

## 12.1 Accès sécurisé au statut

Ajouter un mécanisme adapté :
- utilisateur connecté → contrôle `reporter_id`;
- utilisateur anonyme → token de suivi aléatoire renvoyé à la création.

Éviter une route publique permettant de consulter le détail de n’importe quel incident par simple UUID.

---

# 13. `requested_service`

Valeurs backend actuelles :

```text
fire
ambulance
samu
police
```

Ce champ peut servir d’indication.

## Directive

Le SOS générique ne doit pas obliger l’utilisateur à choisir un service avant l’envoi.

Après l’envoi, option facultative :

```text
Type d’aide souhaitée :
Secours médical
Pompiers
Police
Je ne sais pas
```

### Validation humaine

`requested_service` ne doit pas contourner le principe de validation opérateur.

Il peut :
- filtrer les ressources recommandées ;
- cibler une notification ;
- accélérer la suggestion ;

mais l’affectation opérationnelle doit rester confirmée côté console en mode réel.

---

# 14. Suppression des faux retours secours / hôpital dans l’APK

Dans `HomeScreen.tsx`, supprimer les objets fallback qui fabriquent :
- une unité de secours ;
- un hôpital ;
- une ETA ;

lorsque la réponse backend ne contient pas ces données.

Règle :

```text
backend ne renvoie pas d’unité
→ afficher "En attente d’affectation"

backend renvoie une recommandation
→ afficher "Unité recommandée"

backend confirme une intervention
→ afficher "Unité affectée"
```

Même règle pour l’hôpital.

---

# 15. Console opérationnelle : corrections de cohérence obligatoires

## 15.1 Gravité inconnue

Dans `mobileGateway.js` :

Ajouter une normalisation :

```text
unknown → À évaluer
```

Ne pas utiliser `Critique` comme fallback automatique.

## 15.2 Victimes

Ne plus forcer :

```text
Math.max(1, ...)
```

Si `victims_unknown` :
```text
Non renseigné
```

## 15.3 Véhicules

Corriger les expressions du type :

```text
selected.vehicles || 1
```

car `0` devient alors `1`.

Utiliser une logique explicite.

## 15.4 Mise à jour d’incident

Ajouter la réception / normalisation d’un événement d’update :

```text
incident:updated
```

Fusionner l’incident sans :
- second bip ;
- duplication ;
- recentrage agressif inutile.

## 15.5 Validation réelle

En mode `real`, `updateAlert()` ne doit pas uniquement changer l’état React.

Il doit appeler réellement :

```http
PATCH /api/v1/incidents/:id/status
```

Statuts :
```text
validated
rejected
...
```

Puis utiliser la réponse backend comme source de vérité.

En mode `test`, conserver le comportement de simulation existant.

---

# 16. Console : affectation réelle d’une ambulance

Le backend possède déjà :

```http
POST /api/v1/incidents/:id/assignments
```

avec :

```text
organization_id
response_unit_id
assigned_to
```

La console doit utiliser cette route en mode réel.

## 16.1 Problème actuel

`performAssignment()` crée principalement une mission locale dans `App.jsx`.

`publishRealtime()` ne suffit pas pour persister une affectation réelle.

## 16.2 Cible

En mode réel :

```text
Validation incident
→ choix de l’unité
→ POST assignment backend
→ backend crée intervention
→ backend met à jour incident + unité
→ réponse backend
→ console affiche la mission
→ terminal terrain voit l’intervention
→ déclarant reçoit le nouvel état
```

## 16.3 Ressources réelles

En mode réel, charger les ressources backend réelles via `/api/v1/resources`.

Ne pas essayer d’envoyer au backend un identifiant de démonstration du type :

```text
AMB-01
```

si le backend attend un UUID `response_unit_id`.

---

# 17. Console : mode test et mode réel

Ne jamais mélanger les deux.

### Mode test
- données simulées ;
- 8 étapes ;
- ressources de démonstration ;
- aucune écriture terrain obligatoire.

### Mode réel
- incidents backend ;
- ressources backend ;
- UUID réels ;
- validation persistée ;
- affectation persistée ;
- états terrain persistés.

Les événements réels reçus pendant le mode test restent isolés dans `realEventQueue`, comme prévu.

---

# 18. Cartographie mobile — problème actuel

## 18.1 Diagnostic

`Qr-mobile/src/components/PlatformMap.native.tsx` n’utilise pas actuellement le composant natif `react-native-maps`.

Il encapsule Leaflet dans une `WebView` et charge à distance :
- Leaflet JS depuis `unpkg.com`;
- Leaflet CSS depuis `unpkg.com`;
- les tuiles CARTO.

Les composants enfants `UrlTile` sont actuellement des composants vides dans cette implémentation.

Conséquence :
- un écran peut déclarer un `UrlTile`, mais la carte native l’ignore ;
- si le chargement externe Leaflet / CARTO échoue, la carte peut rester blanche ;
- le comportement APK ne correspond pas réellement au comportement attendu par les écrans.

---

# 19. Nouvelle stratégie carte mobile

## 19.1 Priorité recommandée

Remplacer `PlatformMap.native.tsx` par un vrai wrapper `react-native-maps`, puisque la dépendance existe déjà.

API à conserver :

```text
PlatformMap
Marker
Polyline
UrlTile
animateToRegion()
fitToCoordinates()
showsUserLocation
onPress
onMapReady
```

Ainsi les écrans existants nécessiteront un minimum de modifications.

## 19.2 Tuiles

Utiliser au moins :
1. CARTO Voyager ;
2. OpenStreetMap comme fallback.

Le Web `MapZem.tsx` possède déjà une logique `ReliableTiles` qui bascule après plusieurs erreurs de tuiles.

Reprendre la même philosophie côté mobile.

## 19.3 APK de production

Tester obligatoirement :
- Android réel ;
- build APK/EAS, pas seulement Expo Web ;
- réseau Wi-Fi ;
- réseau mobile ;
- refus GPS ;
- reprise GPS ;
- changement d’orientation non nécessaire car application portrait.

## 19.4 État d’erreur carte

Ne pas laisser un loader infini.

Après timeout :

```text
Carte indisponible
Réessayer
Continuer avec la recherche d’adresse
```

---

# 20. Cartographie Web mobile

Le Web utilise `react-leaflet`.

Conserver cette approche.

Créer un composant partagé :

```text
ReliableTileLayer
```

et l’utiliser sur :
- `MapZem.tsx`
- `MapZemDriver.tsx`
- `RideDetail.tsx`
- toute autre carte citoyenne.

Fallback :
```text
CARTO → OSM
```

Ajouter un appel `invalidateSize()` lorsque la carte apparaît après un panneau/modal/layout susceptible d’avoir initialement une taille nulle.

---

# 21. Zem — GPS passager

## 21.1 Problème

Le passager mobile peut actuellement recevoir un fallback Lomé après refus GPS.

Le Web fait également un fallback de position.

Un fallback visuel peut être utile, mais il ne doit pas être utilisé comme **origine réelle d’une course** sans confirmation.

## 21.2 Cible

Si GPS indisponible :

```text
La carte peut s’ouvrir centrée sur Lomé
MAIS
originSource = fallback
et le bouton "Commander" reste désactivé
```

L’utilisateur doit :
- choisir son point de départ sur la carte ;
- rechercher une adresse ;
- ou réactiver le GPS.

Une fois un vrai départ sélectionné :

```text
originSource = gps | manual
```

Le bouton peut être activé.

---

# 22. Zem — GPS conducteur

Le conducteur ne doit jamais passer `online=true` sans position exploitable.

Si GPS indisponible :

```text
Mode conducteur indisponible
Activez la localisation
```

Ne pas publier de coordonnées de fallback comme position du conducteur.

---

# 23. Zem — position enrichie

Le backend accepte déjà lors de l’archivage d’une position active :

```text
accuracy
heading
speed
```

Faire envoyer ces champs par :
- APK conducteur ;
- Web conducteur lorsque le navigateur les fournit.

Exemple :

```json
{
  "lat": 6.1,
  "lng": 1.2,
  "isOnline": true,
  "accuracy": 7,
  "heading": 140,
  "speed": 8.4
}
```

---

# 24. Zem — requête de course

Le backend identifie déjà le passager avec le JWT.

Dans l’APK, supprimer `passengerId` du body si inutile.

Payload cible :

```json
{
  "originLat": 6.1,
  "originLng": 1.2,
  "destLat": 6.2,
  "destLng": 1.3,
  "distanceKm": 5.2,
  "priceFcfa": 400
}
```

## Amélioration recommandée

Le serveur doit au minimum valider :
- distance raisonnable ;
- prix raisonnable ;
- coordonnées ;
- cohérence géographique.

Idéalement, distance et prix doivent être recalculés / vérifiés côté serveur afin de ne pas faire confiance aveuglément au client.

---

# 25. Zem — cycle d’état unique

Cycle backend à respecter partout :

```text
searching
→ offered
→ accepted
→ driver_en_route
→ driver_arrived
→ ready_to_start
→ in_progress
→ driver_completed
→ completed
```

Branches :
```text
canceled
expired
no_show
disputed
```

APK et Web doivent afficher les mêmes libellés et proposer les mêmes actions.

---

# 26. Zem — offres conducteur

Le backend expire une offre après environ 45 secondes et peut proposer au conducteur suivant.

L’UI doit afficher :
- distance du passager ;
- prix ;
- temps restant facultatif ;
- Accepter ;
- Refuser.

Lors d’une expiration :
- ne pas laisser une carte d’offre morte ;
- recharger automatiquement.

---

# 27. Zem — temps réel et repli

Conserver :
- Supabase Realtime si disponible ;
- polling de secours périodique.

Même résultat fonctionnel Web / APK :
- offre reçue ;
- statut course mis à jour ;
- position conducteur mise à jour ;
- annulation reçue ;
- fin de course synchronisée.

---

# 28. Zem — itinéraire

Utiliser le même utilitaire logique :
- OSRM pour l’itinéraire réel ;
- distance géodésique uniquement comme fallback d’estimation clairement identifié.

Ne pas afficher un tracé droit comme s’il s’agissait d’un itinéraire routier réel.

Si OSRM échoue :
```text
Itinéraire routier indisponible
Distance estimée : X km
```

---

# 29. Hôpitaux / centres de santé

`HopitauxScreen.tsx` utilise l’API :

```text
/geo/hopital-proche
```

et possède également une liste fallback.

## À corriger

Si la liste fallback est utilisée :
- ne pas écrire `établissements réels certifiés` si le backend n’a pas fourni ces données ;
- afficher clairement `données de démonstration / données locales de secours`.

Si le GPS est refusé :
- ne pas calculer des distances utilisateur depuis un faux point sans le signaler ;
- proposer une recherche manuelle / repère.

---

# 30. Adresse et repère

Ne plus envoyer :

```text
Position GPS certifiée
Position GPS web
```

comme si c’était une adresse.

Cible :

1. coordonnées GPS restent la donnée primaire ;
2. reverse geocoding en arrière-plan ;
3. si disponible :
   ```text
   Carrefour GTA, Lomé
   ```
4. sinon :
   ```text
   Position GPS transmise
   ```

Le reverse geocoding ne doit jamais bloquer l’envoi du SOS.

---

# 31. Profil et QR Code

Conserver :
- `qr_token` lorsque l’utilisateur est connecté ;
- signalement possible sans QR ;
- aucune donnée médicale sensible directement contenue dans le QR.

Ne pas rendre la création d’un profil obligatoire pour déclencher un SOS.

---

# 32. Contrat d’incident à uniformiser

Créer un type / schéma de référence documenté.

Exemple logique :

```typescript
type IncidentCreatePayload = {
  source: 'mobile' | 'web';
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'unknown';
  latitude: number;
  longitude: number;
  accuracy: number;
  address?: string;
  victims: number;
  vehicles: number;
  vehicle_type?: string;
  description?: string;
  requested_service?: 'fire' | 'ambulance' | 'samu' | 'police';
  flags: string[];
  qr_token?: string;
  client_event_id: string;
}
```

Le **backend** reste le contrat de vérité.

Mettre à jour :
- `docs/mobile-incident.schema.json`
- `LOTISEC-Console-Complete/MOBILE_INTEGRATION.md`
- les interfaces/types Web et mobile.

---

# 33. Documentation à corriger

## 33.1 `MOBILE_INTEGRATION.md`

Le document parle actuellement d’une architecture cible NestJS / Socket.IO alors que le runtime actuel utilise Express / WebSocket natif + polling.

Le document doit distinguer :
- **architecture réellement implémentée** ;
- éventuelles évolutions futures.

## 33.2 Mémoire universitaire

Ne pas modifier maintenant.

Après validation du code final, reprendre le mémoire pour corriger :
- NestJS → Express si Express reste le backend final ;
- Socket.IO → WebSocket natif / Supabase Realtime / polling selon l’implémentation finale ;
- description réelle du flux SOS ;
- connectivité dégradée uniquement si elle est réellement implémentée ;
- captures finales ;
- diagrammes basés sur le code final.

---

# 34. API console à compléter

Dans `LOTISEC-Console-Complete/src/services/api.js`, ajouter au minimum :

```text
getIncidents()
updateIncidentStatus(id, status)
assignIncident(id, payload)
getInterventions()
getResources()
getFacilities()
```

En mode réel, les actions opérateur doivent passer par ces appels.

Le comportement local actuel peut rester pour le mode test.

---

# 35. Persistance des actions console

## Validation
```text
Console
→ PATCH /api/v1/incidents/:id/status
→ DB
→ réponse
→ UI
```

## Affectation
```text
Console
→ POST /api/v1/incidents/:id/assignments
→ DB : intervention + unité + incident
→ notification terrain
→ réponse
→ UI
```

## Progression terrain
```text
Terminal terrain
→ PATCH /api/v1/interventions/:id/status
→ DB
→ console
→ déclarant
```

Aucune action réelle importante ne doit rester uniquement dans l’état React.

---

# 36. Réception console et normalisation

La console doit distinguer :

```text
incident:new
incident:updated
incident:status_changed
mission:created / intervention créée
position update
```

Si le WebSocket natif reste le mécanisme final, documenter et utiliser ses événements réels.

Le polling REST sert de mécanisme de reprise.

Ne pas maintenir une documentation Socket.IO qui ne correspond pas au runtime.

---

# 37. Sécurité et confidentialité

1. SOS possible sans authentification bloquante.
2. Si utilisateur connecté : rattacher `reporter_id`.
3. Le QR reste facultatif.
4. La console n’a pas besoin du nom complet pour afficher une urgence.
5. Ne jamais diffuser une fiche médicale complète dans l’événement d’alerte.
6. Protéger l’accès au statut détaillé d’un incident.
7. Les actions opérateur restent authentifiées.
8. Affectation et changements d’état restent audités.

---

# 38. Messages UI à harmoniser

## Avant envoi
```text
Confirmer l’alerte
Votre position sera transmise à LOTISEC.
```

## Envoi
```text
Transmission de votre position…
```

## Reçu
```text
Alerte reçue par LOTISEC
En attente de validation.
```

## Hors ligne
```text
Alerte enregistrée sur votre téléphone.
Nouvelle tentative dès le retour du réseau.
```

## Affectée
```text
Une unité a été affectée à votre urgence.
```

## En route
```text
L’unité de secours est en route.
```

Ne jamais afficher `affectée` ou `en route` à partir d’un fallback local.

---

# 39. Parité APK / Web mobile

Créer une matrice de parité et la maintenir.

| Fonction | APK | Web mobile | Backend commun |
|---|---|---|---|
| SOS | Oui | Oui | `/api/v1/incidents` |
| GPS | Expo Location | Geolocation API | coordonnées normalisées |
| Complément incident | À ajouter | À ajouter | PATCH incident |
| Annulation serveur | À ajouter | À ajouter | status cancelled |
| Suivi statut | À ajouter | À ajouter | status sécurisé |
| Hôpitaux proches | Oui | Oui/à aligner | API geo |
| QR | Oui | Oui | scan/profile |
| Zem passager | Oui | Oui | `/zem/*` |
| Zem conducteur | Oui | Oui | `/zem/*` |
| Chat course | Oui | Oui | `/zem/rides/*/messages` |

Aucune fonctionnalité essentielle ne doit exister dans une version et être absente ou contradictoire dans l’autre sans justification explicite.

---

# 40. Ordre d’implémentation obligatoire

## PHASE 1 — contrat et backend
1. Fixer le contrat incident.
2. Ajouter enrichissement d’incident.
3. Corriger dédoublonnage.
4. Ajouter annulation déclarant.
5. Ajouter suivi sécurisé.
6. Vérifier événements backend.
7. Vérifier affectation réelle.
8. Tests backend.

## PHASE 2 — APK SOS
1. supprimer faux GPS ;
2. payload minimal honnête ;
3. accusé serveur ;
4. écran complément ;
5. PATCH complément ;
6. file offline ;
7. annulation réelle ;
8. suivi statut ;
9. suppression des fallbacks secours/hôpital fictifs.

## PHASE 3 — Web mobile SOS
Reproduire exactement les mêmes règles métier.

## PHASE 4 — console réelle
1. normalisation ;
2. unknown ;
3. victimes/véhicules inconnus ;
4. update incident ;
5. validation backend ;
6. affectation backend ;
7. ressources UUID réelles ;
8. suivi des statuts.

## PHASE 5 — cartes
1. refonte `PlatformMap.native.tsx` ;
2. carte Zem passager ;
3. carte Zem conducteur ;
4. carte détail course ;
5. cartes mission terrain ;
6. fallback tuiles Web ;
7. tests APK réel.

## PHASE 6 — Zem
1. GPS fiable ;
2. pas de faux départ ;
3. position enrichie ;
4. cycle statut ;
5. offres ;
6. annulation ;
7. tracking ;
8. OSRM ;
9. parité Web / APK.

## PHASE 7 — tests E2E
Exécuter la matrice complète ci-dessous.

## PHASE 8 — documentation
Mettre à jour :
- `memoire.md`
- `MOBILE_INTEGRATION.md`
- README si nécessaire
- schémas JSON
- tableau des routes.

---

# 41. Tests d’acceptation SOS

## T01 — APK, GPS autorisé
- déclencher SOS ;
- incident créé une seule fois ;
- coordonnées réelles ;
- console reçoit le même incident ;
- aucune donnée inventée.

## T02 — Web, GPS autorisé
Même résultat que T01.

## T03 — GPS refusé
- aucun faux point à Lomé n’est envoyé ;
- utilisateur informé ;
- possibilité repère / carte / appel 118.

## T04 — GPS échec temporaire
- retry ;
- pas de coordonnées fictives.

## T05 — réseau coupé APK
- SOS conservé localement ;
- état `en attente`;
- retour réseau ;
- même `client_event_id`;
- un seul incident console.

## T06 — complément
- incident initial existe ;
- utilisateur ajoute 2 victimes + feu ;
- même incident mis à jour ;
- priorité recalculée ;
- console se met à jour sans second bip.

## T07 — validation console
- opérateur valide ;
- DB passe à `validated`;
- console affiche la réponse serveur ;
- mobile peut voir le nouveau statut.

## T08 — rejet
Même logique avec `rejected`.

## T09 — affectation
- unité réelle disponible ;
- opérateur affecte ;
- intervention créée en base ;
- unité passe `assigned`;
- terminal terrain voit la mission.

## T10 — annulation citoyen
- annulation persistée ;
- console mise à jour.

---

# 42. Tests d’acceptation carte

## M01 — APK Zem passager
- carte visible dans APK release ;
- tuiles visibles ;
- clic carte ;
- marker destination ;
- route visible.

## M02 — APK Zem conducteur
- carte visible ;
- position conducteur réelle ;
- pas de fallback opérationnel.

## M03 — APK RideDetail
- départ ;
- destination ;
- Zem ;
- polyline ;
- rafraîchissement sans écran blanc.

## M04 — Web Zem
- CARTO fonctionne ;
- en cas d’erreurs répétées, fallback OSM.

## M05 — rotation / retour écran
- carte reste fonctionnelle après navigation retour/avant.

## M06 — timeout fournisseur
- message propre ;
- pas de loader infini.

---

# 43. Tests d’acceptation Zem

## Z01 — passager connecté
- choisir vrai départ ;
- choisir destination ;
- OSRM ;
- prix ;
- demande backend.

## Z02 — aucun conducteur
- réponse propre ;
- aucun faux conducteur.

## Z03 — conducteur online
- GPS réel obligatoire ;
- backend reçoit position.

## Z04 — offre
- offre reçue ;
- accept/refuse fonctionne.

## Z05 — cycle complet
```text
accepted
driver_en_route
driver_arrived
ready_to_start
in_progress
driver_completed
completed
```

## Z06 — annulation
- côté passager ou conducteur selon règle ;
- tous les clients voient l’état.

## Z07 — suivi conducteur
- positions réelles ;
- précision/heading/speed si disponibles.

---

# 44. Builds à valider

Backend :

```bash
cd backend
npm test
npm run build
```

Web citoyen :

```bash
cd frontend
npm run build
```

Console :

```bash
cd LOTISEC-Console-Complete
npm run build
```

Mobile :

```bash
cd Qr-mobile
npx tsc --noEmit
npx expo-doctor
```

Puis produire et tester un vrai build Android.

---

# 45. Critères de fin de tâche

La tâche n’est terminée que si :

- [ ] aucun SOS n’envoie de GPS fictif ;
- [ ] APK et Web mobile utilisent le même contrat ;
- [ ] `critical` n’est plus forcé systématiquement ;
- [ ] victimes et véhicules inconnus ne sont pas inventés ;
- [ ] le complément met à jour le même incident ;
- [ ] la console ne duplique pas les updates ;
- [ ] la validation réelle est persistée ;
- [ ] l’affectation réelle est persistée ;
- [ ] le déclarant ne voit pas de statut fictif ;
- [ ] l’annulation est persistée ;
- [ ] la reprise réseau ne crée pas de doublon ;
- [ ] la carte fonctionne dans l’APK release ;
- [ ] Zem passager fonctionne ;
- [ ] Zem conducteur fonctionne ;
- [ ] RideDetail fonctionne ;
- [ ] Web Zem et APK Zem ont les mêmes états ;
- [ ] les builds sont verts ;
- [ ] les tests E2E sont documentés.

---

# 46. Livrable attendu de l’agent IA de développement

À la fin de l’implémentation, fournir :

1. la liste exhaustive des fichiers modifiés ;
2. la raison de chaque modification ;
3. le nouveau contrat incident ;
4. le détail des nouvelles routes backend ;
5. les migrations éventuelles ;
6. les tests exécutés et leurs résultats ;
7. les commandes de build exécutées ;
8. les limites restantes ;
9. les captures ou preuves minimales :
   - SOS APK ;
   - SOS Web ;
   - incident reçu dans console ;
   - complément mis à jour ;
   - carte APK Zem ;
   - carte Web Zem ;
   - intervention créée réellement ;
10. mettre à jour `memoire.md` avec un bilan **réel**, sans annoncer comme terminé ce qui n’a pas été testé.

---

# 47. Ne pas encore modifier les diagrammes du mémoire

Les diagrammes UML seront refaits **après** cette mise à niveau technique.

Raison :
- ils doivent refléter le code final ;
- le diagramme d’état doit représenter un objet réel et unique ;
- le diagramme de séquence doit correspondre au vrai flux ;
- le diagramme de classes doit être dérivé des modèles réellement utilisés ;
- le diagramme de déploiement doit représenter les technologies finales.

Après mise à jour du dépôt, refaire un audit GitHub avant de produire :
- diagramme de classes ;
- activité ;
- séquence ;
- état-transition ;
- déploiement.

---

# 48. Ne pas encore refaire les captures du mémoire

Les captures finales doivent être prises **uniquement après validation du flux final**.

Captures prévues :
1. accueil mobile SOS ;
2. confirmation ;
3. GPS / localisation ;
4. accusé de réception ;
5. complément d’alerte ;
6. statut en attente de validation ;
7. hôpitaux / services proches ;
8. QR / profil ;
9. carte Zem fonctionnelle ;
10. détail d’une course Zem ;
11. console recevant exactement l’incident mobile ;
12. console après complément / validation / affectation.

Toutes les captures doivent être :
- HD ;
- lisibles ;
- sans fond noir illisible ;
- cohérentes avec la version réellement testée.

---

# 49. Étape suivante après développement

Une fois le code poussé et testé :

1. ré-auditer le dépôt GitHub ;
2. vérifier que ce document correspond au code ;
3. figer l’architecture finale ;
4. corriger le mémoire universitaire ;
5. générer les diagrammes ;
6. reprendre les captures ;
7. annoncer et commenter chaque figure ;
8. corriger l’état de l’art ;
9. corriger toutes les références ;
10. préparer les questions de soutenance.

---

# 50. Résultat attendu

À la fin, LOTISEC doit pouvoir démontrer sans contradiction :

```text
Un utilisateur déclenche une urgence depuis l’APK ou le Web.
La vraie position est acquise.
L’incident est créé une seule fois.
La console reçoit exactement les données déclarées.
L’utilisateur peut compléter son signalement sans créer un doublon.
L’opérateur valide.
Une vraie ressource backend est affectée.
La mission existe en base.
Les états progressent.
Le déclarant voit les états réellement confirmés.
Une coupure réseau ne détruit pas le signalement.
Les cartes fonctionnent réellement.
Le flux Zem est cohérent sur Web et APK.
```

C’est cette version réelle et testée qui devra ensuite servir de base au mémoire, aux captures et aux diagrammes.
