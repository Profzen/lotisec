# memoire.md — LOTISEC (ex-SafeLife)

Document de reprise opérationnelle. Ce fichier centralise l'état réel du projet, les décisions actées, les tests effectués, les incidents observés, les blocages et le plan d'exécution.

Statut de référence: **2026-07-31**. Les sections antérieures sont conservées comme historique; la mise à jour opérationnelle finale et `docs/OPERATIONAL_PLATFORM.md` font foi en cas de contradiction.

## 1. Contexte produit et périmètre
- Produit: LOTISEC (Anciennement SafeLife). Mission: localisation, transmission, identification, sécurité, cartographie.
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
- Déploiement en 3 projets Vercel séparés:
  - projet frontend (root `frontend/`)
  - projet backend (root `backend/`)
  - projet console institutionnelle (root `LOTISEC-Console-Complete/`)
- Builds mobile via **EAS Build** (profil `preview` → APK Android).

## 4. État d'avancement par composant

### 4.1 Backend Node (`backend/`)

**Réalisé ✅:**
- Socle API en place (Express + TypeScript).
- Connexion Supabase PostgreSQL prévue via pooler IPv4 et SSL. Au 2026-07-31, la `DATABASE_URL` locale est obsolète (`ENOTFOUND`) et `/health` du backend Vercel répond 500 : la production n’est pas considérée opérationnelle tant que la recette n’est pas rejouée.
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
  - `migrate-accidents-columns.js` (ajout des colonnes manquantes pour éviter l'erreur 500 sur le bouton SOS)
- **Logique Métier Zem** : Limite de rayon de recherche de 5 km ajoutée (`ST_DWithin`) pour commander un Zem (`GET /zem/request`). Ajout de la route `GET /zem/active` pour récupérer le trajet en cours.

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

**Réalisé ✅ (Nouveautés Récentes) :**
- **UI/UX Pixel-Perfect** : L'interface web a été entièrement refondue pour être le clone exact de l'application mobile (Fond vert Lotisec, effet radar SOS, panel blanc arrondi, navigation bottom bar avec icônes Lucide).
- **Module Zem Web** : `MapZem.tsx` fonctionnel sur le web avec OpenStreetMap, Nominatim (recherche), OSRM (itinéraires) et intégration Supabase Realtime pour commander une moto en temps réel (passager) ou recevoir des courses (conducteur via `MapZemDriver.tsx`).
- Bug 404 Vercel corrigé via `vercel.json` (rewrites pour React Router).
- Script de création de comptes de test (Passager + Zem) inséré directement en base via API.
- **Parité Totale Atteinte** : Implémentation du Panneau de Profil (Drawer), modale QR Code sécurisée (impression PDF), Historique des Scans, et Scan Web sécurisé pour les professionnels (`ScanResult.tsx`).
- **Améliorations UX/UI (12 Juin)** : 
  - Notifications Toasts : Remplacement de tous les `alert()` par `react-hot-toast` pour des bulles non-bloquantes.
  - Icônes WhatsApp : Véritables icônes WhatsApp avec redirection `wa.me` sur les fiches de contact.
  - Overlays MapZem : Chargement avec spinner flottant (au lieu du crash "écran vert") et ajout des boutons de retour `ChevronLeft`.
  - Impression propre : CSS `@media print` garantissant l'impression exclusive du QR Code depuis la page Web.
- **Refonte Fullscreen Web & Suivi Live (12 Juin)** :
  - **Layout Fullscreen / Dashboard PC** : Suppression du cadre étroit 480px. Le Web est désormais 100% responsive. La barre de navigation du bas devient une **Sidebar Desktop professionnelle** sur les grands écrans (Dashboard).
  - **Onglet Trajets (`Rides.tsx`)** : Nouveau menu pour afficher la course en cours et **l'historique complet** des trajets (avec statut, prix et distance).
  - **Loaders Transparents** : Suppression de l'écran vert bloquant ("Localisation en cours..."). Remplacé par un `.loader-overlay` élégant superposé au contenu (Hopitaux, MapZem).
  - **Live Tracking** : Abonnement WebSocket à `zem_locations`. Un point dynamique indique en temps réel où se trouve la moto.
  - **Origine Personnalisée** : Capacité de commander un Zem pour un proche en définissant un point de départ différent du GPS.

**En attente / incomplet ⏳:**
- Tout le périmètre actuel (MVP + Parité stricte) est terminé. Rien en attente pour cette phase.

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
  - `ZemPassengerScreen` — commande de course Zem (carte OSM, barre de recherche Nominatim, géocodage inversé, tracé OSRM, prix 75 FCFA/km)
  - `ZemDriverScreen` — mode conducteur Zem (carte OSM, suivi GPS, notifications de course)
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
- **Améliorations UX/UI & Tracking (12 Juin)** : 
  - Synchronisation de toutes les icônes (remplacement des emojis par des composants `FontAwesome` et `Ionicons` pour un look professionnel).
  - Ajout de l'écran "Trajets" (`RidesScreen.tsx`) avec un affichage de l'**historique complet** des courses (terminées, annulées, en attente).
  - **Loaders Transparents** : Suppression de la vue verte bloquante dans `HopitauxScreen`. Remplacé par un `ActivityIndicator` avec fond translucide.
  - **Live Tracking** (`ZemPassengerScreen.tsx`) : Visualisation en temps réel de l'approche du Zem sur la carte après validation de la commande.

**État technique connu ⚠️:**
- `npx tsc --noEmit` remonte **0 erreur**. L'application est 100% clean au niveau TypeScript (correction du `RootStackParamList`, et résolution des imports croisés + appels optionnels `supabase?.` dans les modules `Rides`).

**En attente / incomplet ⏳:**
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
- Variables d'environnement: **✅ Complètes dans `eas.json`**.
- **✅ Build du 2026-06-12 (V2)** : Un build incluant l'historique des trajets, les loaders transparents et les corrections TS est actuellement en cours sur les serveurs d'Expo.
- **✅ Build du 2026-06-12 (V3 - Rebranding)** : Changement global de nom de "Lotisec" vers "118" avec un tout nouveau logo (bouclier et numéro 118). Le build est en cours sur les serveurs d'Expo.

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
- Lancement APK sur appareil: **⏳ En attente de test du nouveau build**.

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

### [RÉSOLU ✅] Blocage 4 — Échec du Build EAS après renommage du package (2026-06-11)
- **Symptôme**: `eas build` échoue immédiatement avec une erreur `slug` mismatch.
- **Cause**: Le `projectId` renseigné dans `app.json` correspondait à l'ancien projet "safelife" tandis que le slug avait été mis à jour à "lotisec".
- **Résolution**: Suppression de `projectId` dans `app.json`, exécution de `eas init --force` pour lier le nouveau projet, puis relance du build.

### [RÉSOLU ✅] Blocage 5 — Échec du Build Android EAS (Gradle AAPT2) (2026-06-12)
- **Symptôme**: EAS échoue lors de la phase `Run gradlew` avec "Gradle build failed with unknown error". Les logs détaillés indiquent `ERROR: .../assets_lotisecbg.png: AAPT: error: file failed to compile` lors de `mergeReleaseResources`.
- **Cause**: Les fichiers d'images `Lotisec-bg.png` et `Lotisec.png` avaient l'extension `.png` mais contenaient des données JPEG. Le compilateur de ressources Android (AAPT2) est extrêmement strict et refuse de compiler des images dont l'extension ne correspond pas au contenu binaire.
- **Résolution**: Les images ont été converties en de véritables fichiers PNG transparents via un script Python local (`Pillow`).

### Blocage actuel: **Aucun**.
- Action requise: **Patienter** pour le téléchargement de la nouvelle APK "Lotisec", puis la **tester** sur appareil physique.

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
7. ~~Commit + push les corrections du 2026-06-11 sur GitHub.~~ ✅ FAIT
8. ~~Relancer `eas build --platform android --profile preview` pour générer un nouvel APK.~~ ✅ FAIT (bloqué temporairement par EAS projectId, résolu avec `eas init`).
9. **⏳ Attendre la fin du build EAS Lotisec**.
10. **⏳ Désinstaller l'ancienne application SafeLife et installer Lotisec**.
11. **⏳ Tester le flux Zem: carte OSM visible, recherche d'adresse Nominatim fonctionnelle**.

## 10. Plan court/moyen terme

### Phase actuelle — Stabilisation MVP (semaine en cours)
1. ⏳ Valider l'APK corrigée sur appareil physique.
2. ✅ Figer le contrat API canonique (payloads + statuts + erreurs) dans un document dédié (`backend/API_CONTRACT.md`).
3. ⏳ Exécuter une matrice de tests bout-en-bout:
   - ✅ auth register/login
   - ⏳ profil create/update
   - ⏳ scan verify (scan QR → page web → fiche urgence)
   - ⏳ alertes create/list/update (SOS → dashboard pro)
   - ⏳ accidents stats/geojson
   - ⏳ courses zem (dispatch + temps réel Supabase)
4. ✅ Intégrer OSRM pour le tracé d'itinéraire et la tarification Zem.
5. ✅ Refonte UI/UX du **frontend web** (design premium, pages Hôpitaux, Conseils et QR Code réalisées).
6. ✅ Nettoyer les erreurs TypeScript résiduelles dans `Qr-mobile`.

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
- 2026-06-11: **Nettoyage et Maintenance Expo**. Suite à des avertissements soulevés par `expo doctor` (dépendances natives dupliquées pour `expo-constants` et versions mineures divergentes), un nettoyage complet a été effectué: suppression de `node_modules` et `package-lock.json`, réinstallation fraîche via `npm install`, et exécution de `npx expo install --fix` pour aligner les versions du SDK Expo (`expo`, `expo-font`, `expo-linking`). La version `1.27.2` de `react-native-maps` a été conservée délibérément malgré l'attente de `1.20.1` pour préserver le bon fonctionnement de `UrlTile` et des cartes OSM.
- 2026-06-11: **Renommage SafeLife → Lotisec**. Remplacement complet du nom de marque dans tout le projet : `app.json` (name, slug, package `com.lotisec.togo`, version bumped à 1.1.0), 10 écrans mobile, 3 fichiers backend, 2 fichiers de config API (fallback URLs migrées de Railway vers Vercel). Nouveau logo Lotisec généré (bouclier aux couleurs du drapeau togolais) et copié dans les assets. Suppression de toutes les références à l'ancien backend Railway (`safelife.up.railway.app`).
- 2026-06-11: **Refonte Module Zem — Recherche d'adresse Nominatim**. L'écran `ZemPassengerScreen` a été entièrement réécrit : (1) Barre de recherche d'adresse avec autocomplétion via l'API gratuite Nominatim (OpenStreetMap), debounce 400ms, limité au Togo. (2) Géocodage inversé au clic sur la carte — affiche le nom du lieu sélectionné. (3) Nouvel utilitaire `src/utils/nominatim.ts` avec rate-limiting intégré (1 req/sec). (4) Correction du serveur de tuiles OSM (`tile.openstreetmap.org` au lieu de `a.tile.openstreetmap.org`) pour meilleure compatibilité Android. (5) Indicateur de chargement de la carte. (6) Panneau inférieur amélioré avec distance et prix structurés.
- 2026-06-11: **Fix texte invisible dans les champs de saisie**. Ajout de `color: colors.text` explicite sur tous les styles `input` et `flexInput` des écrans `Step1Identity`, `Step2Contacts` et `LoginScreen`. Certains appareils Android en mode sombre appliquaient une couleur de texte blanche par défaut, rendant le texte invisible sur fond blanc.
- 2026-06-12: **Atteinte de la Parité Totale Web/Mobile**. L'application Web React a été entièrement mise à niveau pour reproduire à l'identique les fonctionnalités et le design du mobile : Bouton SOS avec animations, tiroir de profil, modale QR code avec export PDF, historique de scans. 
- 2026-06-12: **Mise à jour Cartographie et Module Zem Web**. Transition de `getCurrentPosition` vers `watchPosition` pour un tracking continu sur Web. Création d'une vue dédiée pour les conducteurs `MapZemDriver.tsx` (toggle online/offline, acceptation de courses via canal Supabase, routage OSRM).
- 2026-06-12: **Scan QR Web Sécurisé**. Création d'une page `ScanResult.tsx` permettant au web de lire les tags d'urgence (`/scan/:token`), avec interface protégée par code PIN et restitution de la fiche médicale intégrale, calquée sur `ScanResultScreen.tsx`.
- 2026-06-12: **Succès du Build EAS Android**. Après correction des anomalies AAPT2 (faux fichiers PNG) de la veille, le build `preview` via Expo EAS a été généré avec succès. L'APK finale de Lotisec est prête à être testée sur appareil physique.
- 2026-06-12: **Rebranding majeur Lotisec → 118**. Transition complète de l'identité visuelle de l'application vers "118" (numéro d'urgence). Génération et intégration d'un nouveau logo (bouclier, numéro 118, couleurs vert bouteille et rouge) utilisé comme `favicon` Web, icône Android et SplashScreen. Remplacement du terme "Lotisec" par "118" sur tous les textes de l'interface utilisateur web et mobile (Sidebar, LandingScreen, Home, Maps, alertes, etc.). Le slug technique EAS reste `lotisec` pour assurer la continuité du build. Un Build Expo V3 est lancé avec cette nouvelle identité.
- 2026-06-13: **Fix d'Installation APK ("Application non installée")**. Le nouveau logo généré par l'IA (`logo-118.png`) était en réalité un fichier JPEG déguisé avec une extension `.png`. Cela corrompait la ressource d'icône adaptative Android lors de la compilation, entraînant un rejet pur et simple par le Package Installer d'Android. Le fichier a été converti en véritable PNG via un script Python (Pillow) et un nouveau build a été lancé.
- 2026-06-13: **Mise en place de la PWA (Progressive Web App)**. Transformation de l'application Web en PWA installable nativement. Intégration de `vite-plugin-pwa` pour la génération automatique du `manifest.webmanifest` et du Service Worker. Ajout d'une interface `PwaInstallPrompt.tsx` qui intercepte l'événement navigateur `beforeinstallprompt` pour afficher un modal d'installation convivial (avec support des instructions manuelles pour iOS/Safari). Nettoyage global pour s'assurer que le nom "118" apparaît de manière uniforme partout.
- 2026-06-12: **Fix Critiques Cartographie et GPS**. (1) Web : Correction d'un crash React (`f is not a function`) déclenché par le refus d'accès GPS (`GeolocationPositionError`). Mise en place d'un fallback sécurisé sur Lomé avec bandeau d'avertissement. (2) Mobile/Web : Remplacement du fournisseur de tuiles OSM (`tile.openstreetmap.org`) par **CartoDB Light** (`a.basemaps.cartocdn.com`) pour contourner le blocage strict des User-Agents génériques sur mobile qui rendait la carte grise.
- 2026-06-12: **Fix de Compatibilité React 18 et Erreurs API**. (1) Downgrade de `react-leaflet` de la version v5 vers la v4.2.1 pour assurer la pleine compatibilité avec React 18 et résoudre le crash de nettoyage de hooks (`f is not a function` au démontage de MapContainer). (2) Modification de la capture d'erreur Axios côté Frontend (`err.response?.data?.error`) pour afficher les erreurs fonctionnelles du Backend (exemple: `404 - Aucun Zem disponible à proximité`) plutôt que des messages génériques.
- 2026-07-12/13: **Intégration de l'Assistant IA (RAG)**. Création et déploiement du micro-service `ai_service` (FastAPI, Python) implémentant un chatbot RAG basé sur Llama 3.3 (DeepInfra) avec vectorisation FAISS et transcription/synthèse vocale (SpeechRecognition / gTTS).
- 2026-07-12: **Déploiement en Production**. Le backend Python a été déployé avec succès sur Railway via un `Procfile`. L'URL de production Railway a été injectée dans les applications Web et Mobile en remplacement de `localhost`. Résolution d'une erreur 500 sur Vercel liée au mot de passe de la DB PostgreSQL (encodage URL requis pour Supabase).
- 2026-07-13: **Fixes UI et Génération APK**. Résolution d'un bug d'animation CSS (`animate-spin`) pour le loader sur le frontend Web. Fix d'un bug UI sur l'application mobile Android où le clavier cachait le champ de saisie dans le chat (corrigé via `KeyboardAvoidingView` avec `behavior='height'` et `keyboardVerticalOffset`). Nouvel APK Expo Preview généré avec succès via EAS.
- 2026-08-08: **Intégration du Nouveau Logo & Rebranding LOTISEC**. Remplacement final et uniforme de l'appellation "118" par "LOTISEC" sur les plateformes Web, Console et Mobile (le numéro d'appel d'urgence restant 118). Copie du nouveau logo `lotisec.png` dans les répertoires d'assets mobile et web.
- 2026-08-08: **Refonte des Dialogues et Grilles de la Console**. Remplacement de tous les dialogues `window.prompt` de la console d'administration par des modales HTML5 (`<dialog>`) stylisées. Intégration de puces de grille (`<i></i>`) corrigeant l'alignement des colonnes et chevauchements textuels dans les listes d'administration. Ajout de la déconnexion utilisateur.
- 2026-08-08: **Alignement du Thème Graphique Citoyen (Bleu/Marine/Cyan)**. Migration de la charte de couleurs du portail citoyen (`frontend/`) pour s'aligner sur le bleu d'action (`#1565D8`), le marine d'arrière-plan (`#071A2E`) et le bleu d'accompagnement (`#EAF2FF`), abandonnant l'ancien thème vert.

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
# Mise à jour opérationnelle — 2026-07-31

`LOTISEC-Console-Complete/` est intégré comme troisième application institutionnelle. Le prototype a été raccordé au backend Node central et ne doit plus utiliser Cloudflare D1 comme source métier.

Fondations ajoutées : RBAC multi-rôles et multi-organisations, accréditation Zem, incidents canoniques web/mobile, interventions, ressources terrain, capacités et admissions hospitalières, audit, configuration Vercel et migration Supabase additive. Les SOS web et mobile utilisent désormais `POST /api/v1/incidents`; WhatsApp reste complémentaire.

Références : `docs/OPERATIONAL_PLATFORM.md`, `docs/DEPLOY_CONSOLE_VERCEL.md` et `backend/migrations/20260731_operational_platform.sql`.

La console inclut désormais notifications persistantes avec accusé de lecture, audit administrateur, gestion des agents hospitaliers, capacités isolées par établissement, affichage des responders/accidents historiques, et indication explicite du mode `SUPABASE REALTIME ACTIF` ou du repli `POLLING API AUTHENTIFIÉ`.

## Mise à jour produit — 2026-08-01

- Refonte du design system mobile : marine `#071A2E`, bleu action `#1565D8`, cyan connectivité `#19B5E8`, fonds froids et cartes à forte lisibilité. Le rouge est désormais réservé au SOS/erreur et le vert au succès.
- Nouveaux composants mobiles partagés : cartes de surface, titres de section, boutons d’action et badges d’état.
- Refonte des écrans Landing, connexion, choix de compte/inscription, accueil, navigation inférieure et harmonisation des écrans existants par tokens.
- Les actions « Sapeurs-Pompiers » et « Service ambulancier » créent désormais un incident géolocalisé `requested_service` avant de proposer l’appel téléphonique.
- Les organisations concernées reçoivent une notification ciblée; après affectation, leurs comptes voient la mission et le suivi GPS sur la console responsive, même avant la sélection d’un hôpital.
- Cinq comptes de recette ont été provisionnés en base : citoyen, Zem approuvé, pompier, ambulancier et administrateur. Les mots de passe ne sont pas versionnés.
- Recette réelle réussie : cinq connexions, deux demandes de service, deux notifications ciblées, deux affectations, visibilité professionnelle, deux mises à jour GPS et refus console citoyen.
- Déploiement `ec00fdd` vérifié sur `https://lotisec-delta.vercel.app/console` : la carte suit désormais l’unité vers l’incident avant toute sélection hospitalière.
- Recette Vercel réussie : `requested_service=ambulance` accepté par le backend de production et notification ciblée reçue par le compte ambulancier.

### 2026-08-01 — Migration de l’IA Python/Railway vers Node.js/Vercel

- Les routes de l’assistant sont désormais intégrées au backend Express : `/ai/chat`, `/ai/transcribe`, `/ai/tts` et `/ai/health`.
- Les clients mobile et web utilisent `EXPO_PUBLIC_API_URL` / `VITE_API_URL` et ne contiennent plus l’URL Railway en dur.
- Le RAG n’utilise plus FAISS ni un modèle chargé en mémoire. Les embeddings DeepInfra sont stockés durablement dans Supabase PostgreSQL avec `pgvector` (`ai_documents`, `ai_document_chunks`, `match_ai_chunks`).
- Les usages mobile/web sont observables ensemble dans `ai_request_logs` avec canal, opération, latence, succès et nombre de fragments RAG utilisés.
- La migration `backend/migrations/20260801_ai_rag.sql` a été appliquée à Supabase le 2026-08-01.
- L’indexation se fait avec `cd backend && npm run rag:index`; elle lit `default_code.pdf`, calcule son checksum, reconstruit les fragments et remplace l’index dans une transaction.
- Le microservice `ai_service` et Railway deviennent retirables après validation de `/ai/health` avec `rag_ready=true` et recette chat/audio sur la production Vercel.
- Secret requis uniquement côté backend Vercel : `DEEPINFRA_API_KEY`. La clé historiquement exposée doit être révoquée et remplacée avant la recette finale.

### 2026-08-02 — Mode IA temporaire Railway

- L’implémentation Node/Supabase sous `/ai/*` reste conservée en veille : schéma, routes, scripts et journalisation ne sont pas supprimés.
- Elle est désactivée par défaut; sa réactivation exige `ENABLE_NODE_AI=true` dans le backend Vercel.
- Faute de crédit disponible sur le nouveau compte DeepInfra, le web et le mobile utilisent temporairement le microservice Python Railway historique.
- URL configurable côté web avec `VITE_AI_API_URL` et côté Expo avec `EXPO_PUBLIC_AI_API_URL`; valeur temporaire : `https://agile-trust-production-c862.up.railway.app`.
- Le chargeur Python recherche maintenant `default_code.pdf` dans le dossier courant, à la racine parente du monorepo ou via `RAG_PDF_PATH`, afin de fonctionner avec Railway Root Directory `/ai_service`.
- Retour futur vers Node : renseigner l’URL `https://lotisec-backend.vercel.app/ai` dans les deux variables clientes après migration vers Groq et recette complète, sans modifier les écrans.

## Plan d’exécution — Stabilisation mobile et cycle Zem complet (2026-08-02)

### Audit de départ

- Le chargement infini « Mon QR code » survient lorsque `qrToken` reste nul : le composant affiche un spinner sans erreur ni délai. La session utilise encore plusieurs clés incompatibles (`user`, `profile`, `lotisec_user`).
- L’historique des scans affiché dans `HomeScreen` utilise `DEMO_SCANS`. Sa finalité réelle sera d’informer le propriétaire quand sa fiche a été consultée, par quel type d’autorité, avec quel niveau d’accès et éventuellement à quel endroit : transparence, sécurité et audit des données médicales.
- L’API hôpitaux lit réellement Supabase et trie par distance PostGIS. La production ne contient cependant que trois établissements : CHU Sylvanus Olympio, CHU Campus et Hôpital Dogta-Lafiè. Les noms/coordonnées sont réels, mais le catalogue, les adresses et les attributs d’urgence sont incomplets et issus d’un peuplement manuel.
- Le dispatch Zem sélectionne le conducteur en ligne le plus proche dans 5 km, crée une course `requested` et utilise Realtime pour course/position. Il reste incomplet : notification dépendante de l’écran ouvert, pas d’expiration/réaffectation robuste, pas de chat, pas d’étape conducteur arrivé, pas de double confirmation, et `RidesScreen` lit encore `lotisec_user` au lieu de `user`.
- Il n’existe aucune table/route de messages de course. Plusieurs écrans utilisent encore des emojis comme icônes ou libellés.

### Principes retenus

- Le backend Node/Vercel est l’autorité de toutes les transitions ; aucun client ne modifie directement un statut métier.
- Supabase stocke courses, offres, messages, positions et événements ; Realtime transporte seulement les changements autorisés.
- Toute transition est vérifiée par rôle, participant et état courant, puis auditée.
- Repli par API/polling si Realtime tombe, avec reprise de session et état de connexion visible.
- Aucun établissement fictif en production ; chaque donnée sanitaire porte source et date de vérification.
- Chaque loader finit en succès, état vide ou erreur avec « Réessayer ».

### Phase 0 — Session, QR et navigation

1. Centraliser `token`, `user`, `profile`, `qrToken` dans un module de session et migrer les anciennes clés.
2. Au login/démarrage, appeler `/auth/me`, hydrater rôles/profil/QR et créer/récupérer le profil manquant.
3. Remplacer le spinner QR par `loading | ready | missing-profile | error`, avec délai maximal et réparation explicite.
4. Corriger `RidesScreen` pour utiliser la session canonique, défiler et afficher les erreurs réseau.
5. Remplacer l’onglet « Mon QR » par « Assistant » avec une icône professionnelle. Garder agrandissement, partage et PDF du QR sur l’accueil.
6. Tester session, compte sans profil, QR absent et reprise après reconnexion.

### Phase 1 — Zéro emoji mobile

1. Créer un registre typé d’icônes métier avec `Ionicons`, `MaterialCommunityIcons` ou `FontAwesome`.
2. Remplacer les emojis dans Accueil, Hôpitaux, Conseils, Assistant, Profil, inscription, scan, passager Zem et conducteur Zem.
3. Remplacer aussi les emojis dans alertes/libellés par texte clair et composants vectoriels ; messages externes en texte sobre.
4. Garantir zones tactiles 44 × 44 px, contraste AA et libellés d’accessibilité.
5. Ajouter un contrôle automatisé interdisant tout nouvel emoji dans `Qr-mobile/src`.

### Phase 2 — Historique réel des scans

1. Étendre le schéma : propriétaire, acteur, rôle/organisation, autorité, niveau révélé, date, position optionnelle, résultat.
2. Journaliser chaque consultation réussie dans `/scan/verify`, pas uniquement `POST /scan`.
3. Ajouter `GET /scans/me`, personnel et paginé ; réserver l’historique global aux superviseurs.
4. Remplacer `DEMO_SCANS` par les données réelles avec états vide/erreur.
5. Tester qu’un citoyen ne lit jamais l’historique d’un autre.

### Phase 3 — Hôpitaux réels et tris fiables

1. Ajouter `source`, `source_id`, `last_verified_at`, `verified`, `services`, `opening_hours`, `emergency_level`, `active`.
2. Importer une source ouverte/autoritative pour le Togo (OpenStreetMap validé, complété par les listes officielles disponibles), sans écraser les corrections manuelles validées.
3. Dédupliquer par coordonnées, nom, téléphone et identifiant source ; désactiver plutôt que supprimer.
4. Ajouter rayon, type, urgences, recherche et tri `distance | nom | disponibilité` côté API.
5. Utiliser PostGIS pour le classement et OSRM pour l’ETA routière, avec repli explicite.
6. Afficher provenance/date et tester recherche, filtres, tri, appel et itinéraire.

### Phase 4 — Cycle métier Zem production

1. États canoniques : `searching`, `offered`, `accepted`, `driver_en_route`, `driver_arrived`, `ready_to_start`, `in_progress`, `driver_completed`, `completed`, `canceled`, `expired`, `no_show`, `disputed`.
2. Ajouter `ride_offers` avec expiration et réponse. Proposer le Zem éligible le plus proche dans 5 km puis automatiquement le suivant après refus/expiration.
3. Empêcher les courses incompatibles simultanées et verrouiller l’acceptation en transaction.
4. Ajouter `ride_events` immuable et les horodatages métier sur `rides`.
5. Offre Realtime lorsque l’app est ouverte et notification Expo Push en arrière-plan.
6. Après acceptation, afficher l’approche. Actions conducteur : « Je suis arrivé », puis « Passager à bord ».
7. Démarrage validé par les deux parties ou code court de prise en charge.
8. Pendant le trajet, afficher destination, OSRM, position et ETA restante aux deux parties.
9. À destination : confirmation conducteur puis passager ; prévoir timeout, contestation et clôture assistée.
10. Gérer perte réseau, fermeture d’app, annulation, refus, no-show et reprise.

### Phase 5 — Détail Trajet et carte temps réel

1. Créer `RideDetailScreen` depuis une course active dans « Trajets ».
2. Avant prise en charge : origine, Zem live, ETA, statut et bouton Chat.
3. Après prise en charge : origine terminée, destination, itinéraire, progression, distance/ETA et Chat.
4. Historique en lecture seule ; course active avec actions autorisées par rôle/statut.
5. Un channel Realtime par course, polling de secours et reconnexion sans doublons.
6. Position visible uniquement aux participants et partage arrêté à la clôture.

### Phase 6 — Chat privé passager–Zem

1. Ajouter `ride_messages(id, ride_id, sender_id, body, client_message_id, created_at, read_at)`.
2. Lecture/écriture uniquement aux deux participants, de `accepted` à la clôture ; ensuite lecture seule.
3. Routes paginées, envoi idempotent, accusé de lecture, Realtime et RLS adaptées.
4. Créer `RideChatScreen` : envoi optimiste, retry, non-lus, clavier mobile, horodatage et messages système.
5. Badge non-lu dans « Trajets » et le détail.
6. Prévoir signalement/modération et rétention ; pas de pièces jointes en V1.

### Phase 7 — Notifications et sécurité

1. Stocker les jetons Expo Push par appareil et préférences.
2. Notifier : offre, expiration, acceptation, arrivée, départ, message, arrivée destination, confirmation, annulation.
3. Realtime pour l’app ouverte, push pour l’arrière-plan ; deep-link vers la course.
4. Renforcer RLS de `rides`, `ride_offers`, `ride_messages`, `ride_events`, positions.
5. Limiter fréquence des positions/messages/demandes et auditer les actions sensibles.

### Phase 8 — Parité, tests et déploiement

1. Réutiliser le même contrat Zem/chat sur le web sans dupliquer la logique métier.
2. Écrire migrations additives et tests transitions, autorisations, concurrence, Realtime, chat et réseau.
3. Recette automatisée : citoyen demande, Zem reçoit/accepte, approche, arrive, chat, démarre, progresse, double clôture.
4. Tester Android, Expo Web responsive et Vercel ; valider zéro emoji et zéro loader infini.
5. Déployer Supabase puis backend/frontend ; ne lancer EAS preview qu’après recette Web réussie.
6. Mettre à jour `API_CONTRACT.md`, déploiement et mémoire avec preuves et rollback.

### Critères de recette obligatoires

- Aucun spinner QR infini ; QR créé/récupéré ou réparation explicite.
- Assistant remplace Mon QR dans la barre ; QR téléchargeable depuis l’accueil.
- Aucun emoji comme icône/libellé dans l’application mobile.
- Historique de scans réel, personnel, paginé et protégé.
- Établissements existants avec provenance ; filtres et tris vérifiés.
- Une demande Zem déclenche une offre reçue ; refus/expiration passe au suivant.
- Les participants suivent la bonne carte, discutent pendant la course et reprennent après reconnexion.
- Départ/fin respectent les confirmations ; aucune transition interdite n’est forçable.
- Tests backend/frontend/mobile, export Expo Web et recette production passent avant l’APK.

### Journal d’exécution — 2026-08-02 (jalons 1 et 2)

- Commit `278a487` publié : migration additive Zem/scans/chat, session mobile centralisée, autoréparation profil/QR, historique personnel des scans, détail de course et chat initial.
- `Qr-mobile/src` ne contient plus d’emoji servant d’icône ou de libellé (contrôle `rg` sans résultat) ; remplacement par Expo Vector Icons et indicatifs pays textuels.
- L’onglet inférieur QR est remplacé par Assistant. Le QR reste sur l’accueil avec états `loading | ready | missing/error`, partage et PDF.
- Le conducteur utilise maintenant les offres privées `/zem/offers/current` et `/zem/offers/:id/respond`; sa position est publiée au backend, qui journalise la position liée à la course active.
- Le passage au candidat suivant est déclenché après refus et également lors de la détection d’une offre expirée. L’acceptation est verrouillée en transaction.
- L’écran Trajets comprend tous les états canoniques, les non-lus et ouvre le détail. Le chat est paginé, idempotent par UUID client, doté d’accusés de lecture, Realtime et lecture seule après clôture.
- Notifications : enregistrement natif du jeton Expo par appareil et push backend pour offre, acceptation, changement d’état et message. Expo Web ignore proprement l’enregistrement natif.
- Annuaire médical : schéma de provenance ajouté, importeur OpenStreetMap Togo créé, API filtrable avec distance PostGIS et ETA routière OSRM, provenance/date affichées sur mobile. Les données ne seront qualifiées de production qu’après exécution contrôlée de la migration et de l’import.
- Vérifications locales actuelles : TypeScript mobile réussi, build backend réussi, 18/18 tests backend réussis.
- Migration `20260802_mobile_zem_complete.sql` non encore appliquée en production : l’exécution automatisée a été refusée par la garde de sécurité car elle modifie RLS et convertit les anciens statuts. Aucun contournement effectué.
- Rollback applicatif avant migration : redéployer `511968b`. Rollback données : restaurer le snapshot Supabase pris avant migration ; ne pas supprimer manuellement les tables d’audit.
- Audit Supabase production en lecture seule : types `rides.id=uuid`, utilisateurs/profils/Zem en `varchar`, géométries en `geography`, donc références de la migration compatibles. Les nouvelles tables sont absentes et aucune politique RLS historique n’existe sur `rides`/`zem_locations`. Une ancienne course `requested` existe ; elle est conservée sans mutation et affichée comme « Ancienne demande » afin que la migration reste additive.
- Parité Web ajoutée : jeton Realtime Supabase, offres conducteur privées, actions par statut, détail de course, carte, position et chat via le même contrat backend.
- Sécurité supplémentaire : transitions et événement d’audit dans une transaction verrouillée, annulation limitée aux états actifs, maximum 30 messages/minute et une position archivée toutes les 5 secondes par course/conducteur.
- Gates après ce jalon : 23/23 tests backend, TypeScript mobile réussi, build frontend réussi. Le test anti-emoji parcourt désormais tous les `.ts/.tsx` mobiles via `Extended_Pictographic` et drapeaux régionaux.
- La procédure reproductible de migration, import, recette, notifications, APK et rollback est dans `docs/MOBILE_ZEM_DEPLOYMENT.md`. La recette automatisée est `backend/scripts/e2e-zem-cycle.js` et exige des secrets injectés uniquement par environnement.
- Vérification HTTP production : backend `/health` 200 avec base `up`, frontend citoyen 200, console `https://lotisec-delta.vercel.app` 200. Après détection d’un `500` pré-migration sur l’annuaire, un fallback de schéma a été déployé et `/geo/hopital-proche` répond de nouveau 200 avec `source=legacy` jusqu’à l’import traçable.

## Mise à jour produit — 2026-08-08

### Rebranding global et Intégration Logo LOTISEC
- **Rebranding final 118 → LOTISEC** : Remplacement systématique de toutes les occurrences de "118" par "LOTISEC" (nom définitif de la plateforme, le 118 demeurant uniquement le numéro d'appel d'urgence) sur l'ensemble de la base de code :
  - **Mobile Expo (`Qr-mobile/`)** : Mise à jour de `app.json` (name, slug, package Android), des écrans `HomeScreen.tsx`, `ScanResultScreen.tsx`, `QRCodeScreen.tsx`, `ZemPassengerScreen.tsx`, `AssistantScreen.tsx`, etc.
  - **Web Citoyen (`frontend/`)** : Modification des fichiers `Auth.tsx`, `Home.tsx`, `Assistant.tsx`, `ScanResult.tsx`, `Layout.tsx`, et `PwaInstallPrompt.tsx`.
- **Intégration du logo** : Remplacement du nouveau fichier logo `lotisec.png` (généré par IA : bouclier bleu marine, bleu électrique et cyan) dans les répertoires d'assets mobiles (`Qr-mobile/assets/logo-118.png` pour préserver les liaisons d'imports statiques) et web (`frontend/public/logo-118.png`, `pwa-192x192.png`, etc.).
- **Build EAS Android** : Lancement et succès du build de production Android sur Expo EAS. APK disponible sous l'ID : `47e44af3-9f32-4b04-aea0-0269d9cae41d`.

### Refonte Graphique de la Console d'Administration
- **Formulaires dynamiques via Modales (`<dialog>`)** : Remplacement intégral des boîtes de dialogue système `window.prompt()` par des fenêtres modales HTML5 natives élégantes et intégrées, alignées sur le design system de la console :
  - Modal **Création Utilisateur** (`data-user-modal`) pour enregistrer un nouvel agent.
  - Modal **Création Organisation** (`data-organization-modal`) avec types de structures paramétrés.
  - Modal **Création Agent Hospitalier** (`data-hospital-agent-modal`) pour le personnel d'établissement.
  - Modal **Attribution de Rôle** (`data-grant-role-modal`) dynamique (avec peuplement des organisations actives).
  - Modal **Demande d'Admission** (`data-admission-modal`) et validation de conducteur Zem (`data-zem-modal`).
- **Correction CSS Grid de la Console** : Alignement des listes de données opérationnelles (Membres, Utilisateurs, Admissions, Zem) grâce à l'insertion de balises puces de statut (`<i></i>`) en premier enfant des lignes `.notification-row`, résolvant définitivement les chevauchements de textes et de boutons d'action.
- **Ajout de la déconnexion** : Intégration du bouton "Se déconnecter" sous l'avatar utilisateur avec nettoyage du cache `localStorage`.

### Alignement Visuel du Portail Web Citoyen (`frontend/`)
- **Migration thématique** : Abandon définitif du thème vert historique (`#006a4e` / `#008a66`) du portail Web Citoyen pour s'harmoniser avec la charte graphique de la console et du mobile :
  - Fond de page principal : Marine opérationnel (`#071A2E`).
  - Couleur primaire d'action : Bleu électrique (`#1565D8`).
  - Fond secondaire d'accentuation : Bleu d'accompagnement doux (`#EAF2FF`).
  - Couleur de texte et bordures ajustées en conséquence.
- **Vérification de build** : La commande `npm run build` a été exécutée et s'est terminée avec succès, confirmant l'absence de régression ou d'erreur sur l'application PWA.

## Mise à jour produit — 2026-08-09

### Correction Cartographie Mobile & Web, Commande Zem et Génération QR Code
- **Affichage de la Carte Zem (`Qr-mobile/src/screens/ZemPassengerScreen.tsx`, `ZemDriverScreen.tsx`, `RideDetailScreen.tsx`)** :
  - Suppression de `mapType="none"` qui coupait le pipeline de rendu sous Android/Google Maps SDK.
  - Configuration de `UrlTile` avec `shouldReplaceMapContent={true}`, `tileSize={256}`, `zIndex={1}` et tuiles OpenStreetMap / CartoDB.
  - Définition d'un point de centrage initial par défaut sur Lomé (`6.1375, 1.2125`) en cas de GPS indisponible.
  - Remplacement du composant factice `PlatformMap.web.tsx` par une carte interactive complète propulsée par Leaflet avec marqueurs, polylines, zoom et sélection de coordonnées au clic.
- **Réactivité et Robustesse de Commande Zem (`ZemPassengerScreen.tsx`, `src/utils/osrm.ts`)** :
  - Passage de l'API OSRM en `https://router.project-osrm.org/...` sécurisé.
  - Ajout d'un calcul de distance de secours instantané (Haversine avec coefficient urbain `1.3`), garantissant que `getRoute` ne retourne jamais `null` et que le panneau d'estimation (distance + prix) s'affiche immédiatement au choix du point d'arrivée.
  - Gestion explicite des erreurs et feedback visuel lors du clic sur « Commander le Zem » (indicateur de chargement `ActivityIndicator` sur le bouton, auto-chargement de la session utilisateur `getUser()`, et alertes explicites en cas d'absence de conducteurs à proximité).
- **Génération et Récupération des Codes QR (Mobile & Web)** :
  - **Backend (`backend/src/routers/profil.ts`)** : Ajout des routes `GET /` et `GET /me` (authentifiées) assurant l'auto-création et la restitution du `qr_token` et des données médicales.
  - **Mobile (`Qr-mobile/src/screens/QRCodeScreen.tsx`, `HomeScreen.tsx`, `src/api/profil.ts`)** :
    - Auto-guérison de la session : appel à `/auth/me` si `qr_token` n'est pas en cache local.
    - Export PDF officiel LOTISEC avec logo, identité, groupe sanguin, contacts et QR code vectoriel.
    - Harmonisation des URLs de scan vers `https://lotisec-frontend.vercel.app/scan/${qrToken}`.
  - **Web Citoyen (`frontend/src/pages/QrCode.tsx`, `Home.tsx`)** : Rafraîchissement automatique de la session utilisateur sur `/auth/me` dès l'ouverture si `qr_token` est manquant, garantissant l'affichage instantané du QR code.
- **Validation** : 23/23 tests backend passés (`npm test`), build frontend validé (`npm run build`), TypeScript mobile 0 erreur (`npx tsc --noEmit`).

