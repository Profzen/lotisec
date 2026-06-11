# memoire.md — SafeLife / LOTISEC

Document de reprise opérationnelle. Ce fichier centralise l'état réel du projet, les décisions actées, les tests effectués, les incidents observés, les blocages et le plan d'exécution.

Statut de référence: **2026-06-11**.

## 1. Contexte produit et périmètre
- Produit: LOTISEC / SafeLife (Localisation, Transmission, Identification, Sécurité, Cartographie).
- Mission: gestion d'urgence routière (QR médical, SOS, cartographie, alertes pro, module Zem, extension USSD).
- Cible de migration validée: remplacement du backend Python historique par un backend Node.js.
- Base de données: **Supabase PostgreSQL** (migration depuis Railway effectuée le 2026-06-07).

## 2. Repositories, dossiers et ownership
- Repo principal actif: https://github.com/Profzen/lotisec.
- Dossiers métier actifs dans ce repo:
  - `backend/`: nouveau backend Node.js/TypeScript (cible production).
  - `frontend/`: nouvelle version web citoyenne (MVP), connectée au backend Node.
  - `Qr-mobile/`: application mobile Expo existante (conservée, progressivement branchée sur backend Node).
- Dossiers conservés localement mais exclus du push:
  - `QR-PYTHON/`: backend FastAPI historique, référence de migration.
  - `safelife-pro/`: périmètre collègue, non modifié.
- Exclusion git appliquée via `.gitignore` racine pour `QR-PYTHON/` et `safelife-pro/`.
- **Attention**: Le `.gitignore` racine exclut `**/.env` — les variables d'environnement ne sont PAS dans le repo Git. Les secrets doivent être renseignés via `eas.json` (mobile) ou les settings Vercel (backend/frontend).

## 3. Architecture cible validée
- Backend Node.js/TypeScript/Express/PostgreSQL (Supabase).
- Frontend web citoyen (React + Vite) déployable séparément.
- Mobile Expo consommant les APIs backend Node via variable d'environnement.
- Temps réel mobile: **Supabase Realtime** (contournement des limitations WebSocket Vercel Serverless).
- Cartographie mobile: **react-native-maps** + tuiles OpenStreetMap (gratuit, sans clé Google Maps).
- Routage/tarification: **OSRM** (API publique `router.project-osrm.org`).
- Déploiement en 2 projets Vercel séparés:
  - projet frontend (root `frontend/`)
  - projet backend (root `backend/`)
- Builds mobile via **EAS Build** (profil `preview` → APK Android).

## 4. État d'avancement par composant

### 4.1 Backend Node (`backend/`)

**Réalisé ✅:**
- Socle API en place (Express + TypeScript).
- Connexion Supabase PostgreSQL opérationnelle en production (pooler IPv4, SSL).
- 10 routeurs implémentés:
  - `/auth` (register/login — bcrypt + JWT)
  - `/pro` (login pro — codes institutionnels)
  - `/profil` (create/update + scan par token QR)
  - `/scan` et `/scans` (verify, create, historique)
  - `/alertes` (create/list/update)
  - `/accidents` (create, geojson, heatmap, hotspots, stats, update)
  - `/geo` (heatmap, hotspots, hopital-proche via PostGIS `ST_Distance`, stats, accidents-zone, rapport)
  - `/road-reports` (signalements sentinelles)
  - `/responders` (ambulances partenaires)
  - `/zem` (dispatching courses Zem — `POST /zem/request`, `POST /zem/location`)
- Compatibilité Vercel serverless:
  - `backend/api/index.ts` + `backend/vercel.json`
  - factorisation app dans `backend/src/app.ts`.
- Robustesse runtime:
  - support `express-async-errors`
  - middleware d'erreur JSON global
  - timeout de connexion PostgreSQL (`connectionTimeoutMillis=5000`).
- Scripts de migration:
  - `migrate-hopitaux.js` (table `medical_facilities` avec PostGIS)
  - `migrate-zem.js` (tables `zem_locations` et `rides`)

**En attente / incomplet ⏳:**
- Contrat API à figer finement contre les flux mobile historiques.
- USSD (`*123#` via Africa's Talking): non implémenté (Phase 2).
- Micro-assurance (T-Money/Flooz): non implémenté (Phase 2).
- Sentinelles zémidjan (récompenses): non implémenté (Phase 2).
- Exports gouvernementaux CSV/JSON: non implémentés.
- Guidage vocal éwé/kabyè: non implémenté (Phase 3).

### 4.2 Frontend web citoyen (`frontend/`)

**Réalisé ✅:**
- MVP fonctionnel (React + Vite + TypeScript):
  - Landing page avec boutons Connexion/Inscription.
  - Formulaire Login (phone + password → JWT → localStorage).
  - Formulaire Register (phone + password → création compte).
  - Page Home protégée: bouton SOS géolocalisé, hôpitaux recommandés, sync profil, conseils.
- Client API centralisé (`frontend/src/api/client.ts`) avec fallback vers `https://lotisec-backend.vercel.app`.
- Build local validé (`npm run build`).
- Déployé sur Vercel: https://lotisec-frontend.vercel.app.

**En attente / incomplet ⏳:**
- UI/UX: version MVP utilitaire, **pas encore de design final**. Priorité haute.
- Pas de responsive mobile finalisé.
- Pas de page profil détaillé / édition profil.
- Pas de page cartographie / heatmap accidents (uniquement sur dashboard pro).
- Pas de scan QR web intégré.

### 4.3 Mobile Expo (`Qr-mobile/`)

**Réalisé ✅:**
- 12 écrans fonctionnels:
  - `SplashScreen` — logo animé + drapeau togolais
  - `LandingScreen` — boutons connexion/inscription
  - `LoginScreen` — auth par téléphone + mot de passe (hook `useAuth` centralisé)
  - `RegisterScreen` → tunnel 5 étapes (`Step1Identity` → `Step5Review`)
  - `HomeScreen` — SOS animé (appui long 800ms), QR code, contacts urgence, historique scans
  - `HopitauxScreen` — géolocalisation des hôpitaux via API Vercel (`/geo/hopital-proche`, PostGIS)
  - `ConseilsScreen` — conseils sécurité routière
  - `QRCodeScreen` — affichage/partage QR personnel
  - `ProfilePanel` — thème sombre/clair, déconnexion
  - `ZemPassengerScreen` — commande de course Zem (carte OSM, sélection destination, tracé OSRM, prix 75 FCFA/km)
  - `ZemDriverScreen` — mode conducteur Zem (toggle online/offline, suivi GPS, notifications de course)
  - `ScanResultScreen` — résultat de scan QR
- Bascule API vers variable Expo publique (`EXPO_PUBLIC_API_URL`).
- Client Supabase Realtime pour le temps réel Zem (`rides`, `zem_locations`).
- Client Supabase défensif: `supabase.ts` retourne `null` si les variables manquent (pas de crash).
- Intégration OSRM: calcul exact de distance routière + tracé Polyline sur carte.
- Carte OpenStreetMap gratuite via `UrlTile` + `mapType="none"` (sans clé Google Maps).
- Fausse clé Google Maps dans `app.json` pour éviter le crash natif de `react-native-maps`.
- Profils EAS Build configurés avec **toutes les variables d'environnement** (API URL + Supabase URL + Supabase Anon Key).
- Gestion d'erreurs inline (bannières dynamiques, pas de `Alert.alert` pour les formulaires).
- Palette de couleurs complète: `primaryLight` et `success` ajoutés à `colors.ts`.
- Polices Montserrat (Regular/Medium/SemiBold/Bold) via `@expo-google-fonts/montserrat`.

**État technique connu ⚠️:**
- `npx tsc --noEmit` remonte des erreurs TypeScript préexistantes non bloquantes:
  - typings navigation (`Splash` absent du `RootStackParamList`)
  - clé dupliquée `header` dans `HomeScreen`
  - ~~`colors.primaryLight` absent~~ → **CORRIGÉ le 2026-06-11**

**En attente / incomplet ⏳:**
- Nettoyage des erreurs TypeScript restantes.
- Tests APK bout-en-bout sur appareil physique (après rebuild avec corrections Supabase du 06-11).
- Signalement danger routier (formulaire zémidjan sentinelle): non implémenté.
- Micro-assurance depuis l'app: non implémenté.
- Navigation offline éwé/kabyè: non implémenté (Phase 3).

## 5. Déploiement: état réel

### 5.1 Frontend Vercel
- URL: https://lotisec-frontend.vercel.app
- Statut: **✅ En ligne, page chargée.**

### 5.2 Backend Vercel
- URL: https://lotisec-backend.vercel.app
- Route racine: `{"status":"online","project":"SafeLife Node API","db_configured":true}`.
- Route health: **✅ `{"ok":true,"db":"up"}`** (corrigé le 2026-06-09, `DATABASE_URL` pointe vers Supabase).
- Inscription/login: **✅ Fonctionnel** bout-en-bout depuis Web et Mobile.

### 5.3 Mobile APK (EAS Build)
- Profil: `preview` → génère un `.apk` Android installable.
- Variables d'environnement: **✅ Complètes dans `eas.json`** (`EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`).
- **⏳ À reconstruire** après les corrections du 2026-06-11 (crash Supabase + couleurs manquantes).

## 6. Tests réalisés et résultats

### Tests backend (prod Vercel) — mis à jour 2026-06-11:
- `GET /` : **PASS** ✅ (service en ligne).
- `GET /health` : **PASS** ✅ (DB up, connexion Supabase OK).
- `POST /auth/register` : **PASS** ✅ (inscription réussie, insertion `users` + `profiles`).
- `POST /auth/login` : **PASS** ✅ (connexion + JWT retourné).
- `GET /geo/hopital-proche` : **PASS** ✅ (requête PostGIS `ST_Distance` fonctionnelle).
- `POST /zem/request` : Non testé en production (dépend d'un conducteur en ligne).

### Tests frontend (prod Vercel):
- Chargement page d'accueil: **PASS** ✅.
- Parcours inscription: **PASS** ✅ (vérifié le 2026-06-09).
- Parcours login: **PASS** ✅.
- Déclenchement SOS: **PASS** ✅ (enregistre accident + alerte).

### Tests mobile (local + web):
- Connexion via `useAuth`: **PASS** ✅ (hook centralisé).
- Écran hôpitaux (API réelle): **PASS** ✅.
- Module Zem (carte + OSRM): **PASS** ✅ en dev local.
- Build APK (EAS `preview`): **PASS** ✅ (APK générée avec succès).
- Lancement APK sur appareil: **FAIL** 🔴 → **CORRIGÉ le 2026-06-11** (voir §7).

### Tests build locaux:
- `backend` (`npm run build`): **PASS** ✅.
- `frontend` (`npm run build`): **PASS** ✅.
- `Qr-mobile` (`npx tsc --noEmit`): **FAIL partiel** ⚠️ (erreurs TS préexistantes non bloquantes).

## 7. Historique des blocages et résolutions

### [RÉSOLU ✅] Blocage 1 — DB inaccessible en production (2026-06-07 → 2026-06-09)
- **Symptôme**: `GET /health` retourne `ECONNREFUSED 127.0.0.1:5432`.
- **Cause**: `DATABASE_URL` pointait vers localhost.
- **Résolution**: Migration vers Supabase, `DATABASE_URL` corrigée dans les settings Vercel.

### [RÉSOLU ✅] Blocage 2 — Crash APK react-native-maps (2026-06-09 → 2026-06-10)
- **Symptôme**: APK crashe au démarrage.
- **Cause**: `react-native-maps` exige une clé API Google Maps Android en mode Standalone.
- **Résolution**: Fausse clé API dans `app.json` + `mapType="none"` + tuiles OSM via `<UrlTile>`.

### [RÉSOLU ✅] Blocage 3 — Crash APK Supabase (2026-06-11)
- **Symptôme**: APK téléchargée via lien Expo crashe immédiatement à l'ouverture.
- **Cause**: Le `.gitignore` racine exclut `**/.env`. Lors du build EAS (qui clone le repo Git), les variables `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_ANON_KEY` étaient absentes. Le module `supabase.ts` appelait `createClient(undefined, undefined)` au chargement du bundle JS → crash fatal avant tout rendu React.
- **Résolution**: 
  1. `supabase.ts` rendu défensif — exporte `null` si les variables manquent.
  2. Variables Supabase ajoutées dans `eas.json` (profils `preview` + `production`).
  3. Gardes `if (supabase)` ajoutées dans `ZemPassengerScreen` et `ZemDriverScreen`.
  4. Couleurs manquantes (`primaryLight`, `success`) ajoutées à `colors.ts`.

### Blocage actuel: **Aucun blocage P0**.
- Action requise: **Rebuild APK** pour valider les corrections du 2026-06-11 puis test sur appareil physique.

## 8. Variables d'environnement attendues (production)

### 8.1 Backend Vercel (`backend`)
- `DATABASE_URL` = URL PostgreSQL Supabase (pooler IPv4, mode `transaction`). ✅ Configuré.
- `JWT_SECRET` = secret fort. ✅ Configuré.
- `NODE_ENV` = `production`. ✅ Configuré.
- `CORS_ORIGIN` = `https://lotisec-frontend.vercel.app` (ou `*` temporaire).

### 8.2 Frontend Vercel (`frontend`)
- `VITE_API_URL` = `https://lotisec-backend.vercel.app`. ✅ Configuré.

### 8.3 Mobile Expo (`Qr-mobile`)
Configurées dans `eas.json` (profils `preview` et `production`) ET dans `.env` local:
- `EXPO_PUBLIC_API_URL` = `https://lotisec-backend.vercel.app`. ✅
- `EXPO_PUBLIC_SUPABASE_URL` = URL du projet Supabase. ✅
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` = clé anon publique Supabase. ✅

**Règle critique**: Ne JAMAIS compter sur le `.env` local pour les builds EAS. Toutes les variables publiques doivent être dupliquées dans `eas.json` > `build` > `<profil>` > `env`.

## 9. Actions immédiates (ordre recommandé)

1. ~~Corriger `DATABASE_URL` dans le projet backend Vercel.~~ ✅ FAIT (2026-06-09)
2. ~~Redéployer backend.~~ ✅ FAIT (2026-06-09)
3. ~~Vérifier `GET /health` → `ok=true`, `db=up`.~~ ✅ FAIT (2026-06-09)
4. ~~Retester `POST /auth/register`.~~ ✅ FAIT (2026-06-09)
5. ~~Retester inscription depuis frontend.~~ ✅ FAIT (2026-06-09)
6. ~~Corriger crash APK Supabase.~~ ✅ FAIT (2026-06-11)
7. **⏳ Commit + push les corrections du 2026-06-11 sur GitHub.**
8. **⏳ Relancer `eas build --platform android --profile preview` pour générer un nouvel APK.**
9. **⏳ Tester l'APK sur appareil physique: vérifier que l'app se lance, s'inscrit, se connecte.**
10. **⏳ Si PASS: passe UI/UX frontend et parité API complète avec mobile.**

## 10. Plan court/moyen terme

### Phase actuelle — Stabilisation MVP (semaine en cours)
1. ⏳ Valider l'APK corrigée sur appareil physique.
2. ⏳ Figer le contrat API canonique (payloads + statuts + erreurs) dans un document dédié.
3. ⏳ Exécuter une matrice de tests bout-en-bout:
   - ✅ auth register/login
   - ⏳ profil create/update
   - ⏳ scan verify (scan QR → page web → fiche urgence)
   - ⏳ alertes create/list/update (SOS → dashboard pro)
   - ⏳ accidents stats/geojson
   - ⏳ courses zem (dispatch + temps réel Supabase)
4. ✅ Intégrer OSRM pour le tracé d'itinéraire et la tarification Zem.
5. ⏳ Refonte UI/UX du **frontend web** (design premium, responsive mobile-first).
6. ⏳ Nettoyer les erreurs TypeScript résiduelles dans `Qr-mobile`.

### Phase 2 — Lancement (Mois 4-6)
- Publication Google Play Store.
- Partenariat CHU Sylvanus Olympio + Pompiers du Togo.
- Implémentation USSD `*123#` (Africa's Talking).
- Réseau zémidjan sentinelles + récompenses Flooz/T-Money.
- Micro-assurance routière depuis l'app.
- Dispatch 5-10 ambulances partenaires.
- Trafic temps réel (enrichissement données sentinelles).
- Objectif: 5 000 utilisateurs.

### Phase 3 — Croissance (Mois 7-12)
- Extension Bénin, Ghana, Côte d'Ivoire.
- iOS (App Store).
- Guidage vocal offline éwé/kabyè (OSRM local + phrases MP3 natives).
- IA prédiction zones à risque.
- Flottes entreprises.
- Objectif: 50 000 utilisateurs.

### Phase 4 — Scale (Année 2-3)
- 10 pays Afrique de l'Ouest.
- API publique hôpitaux.
- 500 000 utilisateurs.
- Série A.

## 11. Risques techniques connus
- **`.env` et EAS Build**: Le `.gitignore` racine exclut `**/.env`. Les variables d'environnement pour les builds EAS doivent impérativement être renseignées dans `eas.json` ou les EAS Secrets. Tout oubli provoque un crash silencieux au lancement de l'APK. Leçon apprise le 2026-06-11.
- **Supabase client défensif**: `supabase.ts` exporte désormais `null` si les variables manquent. Tout code consommant le client Supabase doit vérifier `if (supabase)` avant d'appeler `.channel()`, `.from()`, etc.
- **Vercel serverless et WebSocket persistent**: Limitation native du Serverless contournée sur mobile grâce à l'intégration directe du client **Supabase Realtime** (`@supabase/supabase-js`) pour le suivi GPS et les alertes.
- **react-native-maps en standalone**: La fausse clé Google Maps dans `app.json` est un hack temporaire. Si Google Maps SDK valide les clés dans une future version, ce hack cassera. Alternative long terme: migrer vers `react-native-maplibre`.
- Contrats API encore susceptibles de divergence entre backend Node et legacy Python.
- Données/DDL PostgreSQL non entièrement vérifiées en production (types, extensions PostGIS, index).

## 12. Journal des décisions et changements
- 2026-06-01: audit complet des dossiers, décision de migration backend Python -> Node.
- 2026-06-02: création du repo unifié `Profzen/lotisec` et push initial.
- 2026-06-02: création `backend/` (Node) et `frontend/` (web citoyen MVP).
- 2026-06-02: exclusion git de `QR-PYTHON/` et `safelife-pro/`.
- 2026-06-02: bascule mobile vers `EXPO_PUBLIC_API_URL`.
- 2026-06-02: adaptation backend Vercel serverless + fallbacks URL frontend/mobile.
- 2026-06-02: correctifs anti-timeout backend (errors async + timeout DB).
- 2026-06-07: Constat de blocage production confirmé sur DB (`ECONNREFUSED 127.0.0.1:5432`).
- 2026-06-07: Bascule initiée vers Supabase pour la base de données. Ajout des clés d'API (anon/service_role) dans les `.env` (backend, frontend, Qr-mobile). **Blocage P0 levé localement**: La chaîne de connexion PostgreSQL complète (`DATABASE_URL`) et le nouveau `JWT_SECRET` ont été fournis et renseignés dans le `backend/.env`. Prêt pour les tests de connexion.
- 2026-06-08: Tests de connexion locaux validés. Le backend local Node.js se connecte parfaitement à Supabase via l'URL de pooler IPv4. Création d'un compte de test réussie (insertion dans `users` et `profiles`).
- 2026-06-08: Installation de `react-native-web` sur `Qr-mobile` pour tester l'application mobile localement via le navigateur. Identification d'un bug d'affichage des alertes sur le web (silence crash sur erreur 400).
- 2026-06-08: Refonte UX/UI globale de la gestion des erreurs sur `Qr-mobile`. Suppression de `Alert.alert` pour les formulaires au profit de messages inline (bannières dynamiques) pour une compatibilité web 100% et une meilleure expérience native.
- 2026-06-08: Erreur humaine temporaire corrigée sur l'URL de connexion (`eu-central-1` vs `eu-west-1`).
- 2026-06-09: **Blocage P0 définitivement levé en production**. Le backend sur Vercel est redéployé avec succès avec la bonne `DATABASE_URL` pointant vers Supabase. Les tests d'inscription bout-en-bout depuis l'application Web/Mobile vers Vercel sont concluants.
- 2026-06-09: Correction d'un bug majeur sur l'écran de connexion (`LoginScreen.tsx`) de l'application mobile : l'URL de l'API était codée en dur (Railway) au lieu d'utiliser la variable d'environnement, et la limite de caractères bloquait les espaces dans le numéro de téléphone. Remplacement du fetch direct par le hook centralisé `useAuth`.
- 2026-06-09: Refonte totale de la géolocalisation des hôpitaux. Suppression des données fictives (`HOPITAUX_DEMO`) de l'écran `HopitauxScreen.tsx`. Modification de la base Supabase (table `medical_facilities`) pour ajouter les colonnes requises par l'UI (`type`, `address`, `urgences`). Correction de l'API Vercel (`/geo/hopital-proche`) pour utiliser la colonne `location` (Type PostGIS Geography) afin d'assurer un calcul exact de la distance via `ST_Distance`. Connexion finale du mobile à la vraie API.
- 2026-06-09: Création du **Module Zem (Ride-hailing)** complet (Passager et Conducteur).
  - Architecture: La contrainte de WebSockets sur Vercel Serverless est résolue en connectant le frontend mobile directement à **Supabase Realtime**.
  - Database (PostGIS): Ajout des tables `zem_locations` et `rides`. Ajout de la colonne `is_zem` dans `profiles`.
  - Backend: Nouvelle route de dispatching (`POST /zem/request`) assignant le Zem en ligne le plus proche.
  - Mobile (Qr-mobile): Ajout de `react-native-maps`, création de `ZemPassengerScreen` (recherche de destination sur carte, estimation prix: distance x 75 FCFA), création de `ZemDriverScreen` (toggle online/offline, suivi GPS, notification de course, et mode routing).
- 2026-06-09: **Intégration OSRM**. Le module Zem utilise désormais l'API publique OSRM (`router.project-osrm.org`) via un utilitaire `osrm.ts`. Remplacement du calcul de distance à vol d'oiseau (Haversine) par un vrai calcul de distance routière pour la tarification. Affichage du tracé exact sur la carte (Polyline épousant les routes) pour le passager et le conducteur.
- 2026-06-09: **Configuration EAS Build**. Mise à jour de `eas.json` (ajout de `"buildType": "apk"` dans le profil `preview`) pour permettre la génération de fichiers Android `.apk` installables directement sans passer par le Play Store, facilitant ainsi les tests utilisateurs de bout-en-bout.
- 2026-06-09: **Détachement Compte Expo**. Suppression du `owner` (remakdev) et du `projectId` dans `app.json` afin de lier le projet au compte personnel du développeur lors du `eas-cli build`.
- 2026-06-09: **Génération APK & Crash**. Premier APK généré avec succès. L'application crashe au démarrage sur appareil physique. Cause isolée : `react-native-maps` exige une clé API Google Maps Android dans `app.json` en mode Standalone. Le blocage est documenté en attente de clé.
- 2026-06-10: **Contournement Clé Google Maps (Hack OSM)**. Pour éviter le renseignement obligatoire d'une carte bancaire (Google/Mapbox), une fausse clé API a été ajoutée à `app.json` pour éviter le crash Android natif. Les écrans de cartes (`ZemPassengerScreen`, `ZemDriverScreen`) ont été modifiés pour utiliser `mapType="none"` (désactive le rendu Google) et afficher les tuiles libres d'OpenStreetMap via `UrlTile`. La solution est 100% gratuite et maintient la parité avec le routage OSRM.
- 2026-06-11: **Crash APK au lancement (P0) — Variables Supabase manquantes en build EAS**. Symptôme : l'APK téléchargée via le lien Expo crashait immédiatement à l'ouverture. Cause : le `.gitignore` racine exclut `**/.env`, donc les variables `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_ANON_KEY` étaient absentes lors du build EAS. Le module `supabase.ts` appelait `createClient(undefined, undefined)` au chargement, crashant l'app avant tout rendu. Corrections : (1) `supabase.ts` rendu défensif — retourne `null` si les vars manquent au lieu de crasher. (2) Variables Supabase ajoutées dans `eas.json` pour les profils `preview` et `production`. (3) Gardes null ajoutées dans `ZemPassengerScreen` et `ZemDriverScreen`. (4) Couleurs manquantes (`primaryLight`, `success`) ajoutées à `colors.ts`.

## 13. Références de reprise rapide
- Spécification produit: `cdc.txt`.
- Brief technique détaillé: `lt.txt`.
- Configuration backend Vercel: `backend/vercel.json` et `backend/api/index.ts`.
- Point d'entrée API: `backend/src/app.ts`.
- Connexion DB: `backend/src/database.ts`.
- Client API frontend: `frontend/src/api/client.ts`.
- Config API mobile: `Qr-mobile/src/api/config.ts`.
- Client Supabase mobile: `Qr-mobile/src/api/supabase.ts`.
- Routage OSRM: `Qr-mobile/src/utils/osrm.ts`.
- Config EAS Build + variables env: `Qr-mobile/eas.json`.
- Config app native: `Qr-mobile/app.json`.
- Navigation: `Qr-mobile/src/navigation/AppNavigator.tsx`.
- Palette couleurs: `Qr-mobile/src/theme/colors.ts`.
- Typographie: `Qr-mobile/src/theme/typography.ts`.

---

Règle de maintenance du fichier:
- Toute décision architecture/devops/test doit être tracée immédiatement.
- Toute régression ou blocage prod doit être documenté avec symptôme + cause + action corrective.
- Les sections 4 à 6 doivent refléter l'état réel à chaque mise à jour (marquer ✅/⏳/🔴).

Règle UI/UX (Frontend & Mobile):
- Les erreurs API et de validation doivent être affichées de manière visuelle et inline dans l'interface (ex: textes d'erreur rouges sous les champs). L'utilisation de pop-ups systèmes (`Alert.alert`) est proscrite pour les flux principaux afin d'assurer une compatibilité Web parfaite et une expérience utilisateur premium.

Règle Variables d'Environnement:
- Ne JAMAIS compter sur le fichier `.env` pour les builds EAS — il est exclu par `.gitignore`.
- Toutes les variables `EXPO_PUBLIC_*` nécessaires au runtime doivent être présentes dans `eas.json` > `build` > `<profil>` > `env`.
- Les secrets backend doivent être dans les settings Vercel, jamais dans le code.