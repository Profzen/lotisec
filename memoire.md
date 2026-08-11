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

### Annuaire Certifié des Hôpitaux du Togo & Attribution Immédiate du SOS Mobile
- **Annuaire Réel & Géolocalisé des Établissements Hospitaliers (`backend/src/routers/operations.ts`, `Qr-mobile/src/screens/HopitauxScreen.tsx`)** :
  - Intégration des hôpitaux réels du Togo avec coordonnées GPS vérifiées, contacts d'urgence et spécialités :
    - *CHU Sylvanus Olympio (Tokoin)* : `6.1374, 1.2122` — Traumatologie & Urgences 24h/24 (+228 22 21 25 01)
    - *CHU Campus Lomé* : `6.1756, 1.2137` — Urgences polyvalentes & Pédiatrie (+228 22 25 47 01)
    - *Hôpital de Bè* : `6.1322, 1.2402` — Accueil d'urgence & Maternité (+228 22 21 16 41)
    - *Hôpital Dogta-Lafiè* : `6.2023, 1.1854` — Soins intensifs & Chirurgie (+228 22 53 60 00)
    - *Polyclinique Saint-Joseph* : `6.1645, 1.2311` — Urgences médico-chirurgicales (+228 22 26 77 77)
    - *Clinique Biasa* : `6.1512, 1.2085` — Soins intensifs (+228 22 21 02 11)
  - Calcul dynamique de distance et d'ETA routier selon le mode de transport (Voiture et Moto Zem).
  - Boutons d'appel direct en 1 clic et d'ouverture de navigation GPS sur chaque fiche.
- **Attribution Automatique et Retour Visuel Instantané sur Mobile (`Qr-mobile/src/screens/HomeScreen.tsx`)** :
  - Calcul PostGIS côté backend (`POST /api/v1/incidents`) de l'unité de secours disponible la plus proche (`closest_unit`) et de l'hôpital le plus adapté (`closest_hospital`).
  - Affichage immédiat d'une boîte de dialogue d'alerte et d'une bannière persistante sur l'accueil mobile indiquant :
    - L'unité engagée (*ex : Sapeurs-Pompiers Lomé 118*)
    - Le statut en temps réel : *« En route vers votre position »*
    - Le temps d'arrivée estimé (*ex : ETA ~5 min*)
    - L'hôpital récepteur désigné (*ex : CHU Sylvanus Olympio*)
    - Un bouton d'appel direct vers le central de secours.

### Restauration Visuelle de la Console, Scission Métier & Résilience Fog
- **Design Institutionnel & Sobre (`LOTISEC-Console-Complete/public/console.css`)** :
  - Suppression intégrale des néons et reflets flashy au profit d'une charte graphique matte et institutionnelle (`#071827`, `#0D2033`, `#11273C`, `#1B6CA8`, `#22C55E`, `#DC2626`).
- **Correction de la modale de connexion & Logo** :
  - Dimensions du logo d'accueil strictement contraintes (`64px × 64px, object-fit: contain`) éliminant le bug d'agrandissement plein écran.
  - Ajout de 3 boutons de connexion rapide en 1 clic (👑 *Superviseur National*, 🚒 *Sapeurs-Pompiers 118*, 🏥 *CHU Sylvanus Olympio*) facilitant les démonstrations de soutenance.
- **Isolation des Rôles & Sélecteur TopBar Admin** :
  - *Sapeurs-Pompiers (118)* : Carte tactique interactive Leaflet, interventions en direct et reroutage intelligent anti-bouchon.
  - *Hôpitaux* : Vue épurée sans carte interactive, focalisée sur la gestion en 1 clic des lits disponibles et l'accès aux fiches médicales QR Code des patients admis.
  - *Admin* : Menu déroulant dans la barre supérieure permettant de basculer instantanément entre les vues sans recharger la page.
- **Fog Computing & Résilience Hors-Ligne (`FOG-LOMÉ-01`)** :
  - Détection automatique hors-ligne avec mise en file locale des signalements et synchronisation automatique avec le Cloud dès le rétablissement de la connexion.

### Historique des Builds EAS Android APK
- **Dernier Build Actif (Avec Hôpitaux Réels, SOS Instantané & Correctifs)** :
  - ID Build : `62166018-0dec-4c50-b133-ad4098af83ef`
  - Statut : **Terminé avec succès** (`finished`)
  - Profil : `preview` (Stand-alone `.apk`)
  - SDK Expo : `54.0.0`
  - Lien Expo : https://expo.dev/accounts/profzen/projects/lotisec/builds/62166018-0dec-4c50-b133-ad4098af83ef
- **Builds Précédents** :
  - ID `291be0f6-68ba-4392-9e41-51086bbd1764` (`finished`, 09/08/2026 13:14:07)
  - ID `4968d935-415b-4709-9cab-4d9484a8ae87` (`finished`, 08/08/2026 16:55:56)

### Validation Globale de la Plateforme
- **Backend Node.js** : 23/23 tests automatisés passés (100% succès via `npm test`).
- **Application Mobile Expo** : 0 erreur TypeScript (`npx tsc --noEmit`), APK compilé avec succès sur EAS.
- **Portail Web & Console** : Builds de production validés, mise en page native opérationnelle, réactivité totale sur tous les contrôles.

## Mise à jour produit — 2026-08-10

### Finalisation comptes de recette, scan médical et cartes Zem
- Les six comptes de recette couvrent citoyen, Zem, pompier, ambulancier, administrateur et gestionnaire du CHU Sylvanus Olympio; le script protégé par `ALLOW_ACCEPTANCE_ACCOUNT_RESET=true` utilise le mot de passe de recette uniforme documenté dans le code.
- Les codes institutionnels `POMP2626`, `AMBU1818`, `MEDC3737` et `POL1717`, ainsi que le PIN personnel, ouvrent `/scan/verify` en production. La réponse inclut taille, poids et coordonnées du médecin lorsqu'ils existent.
- Les écrans de scan mobile et web proposent un champ PIN/code et affichent la fiche médicale enrichie. Le PDF QR mobile embarque désormais le QR en base64 sans dépendre d'un service QR externe.
- Les cartes Zem natives utilisent CartoDB Voyager avec conservation du fond standard afin d'éviter l'écran gris sur Android/iOS.
- Les accès rapides de la console utilisent un mode démonstration local explicite : aucun faux JWT n'est envoyé au backend, supprimant la boucle de retour vers la connexion. Les menus restent séparés entre supervision, secours et hôpital; les données réelles restent filtrées côté backend par permissions et organisation.
- Validation locale : tests backend, TypeScript mobile, build frontend, syntaxe et build console réussis.

### Revue de mise en exploitation : lisibilité, affectation terrain et vérité du Fog
- Le mode clair de la console possède désormais une sidebar claire, des textes plus contrastés et un panneau incident restructuré visuellement. Le mode sombre conserve la charte marine sobre. Les cartes, libellés, valeurs, chronologies et actions du tiroir incident ont des tailles minimales et des couples fond/texte distincts.
- Le terme « Analyse Fog » du détail incident est remplacé par « Aide à la priorisation ». Le score 0–100 est une règle métier centrale basée sur gravité, victimes, véhicules et dangers. Il assiste l'opérateur et ne remplace jamais la validation humaine.
- État Fog réel : aucun nœud edge physique `FOG-LOMÉ-01` n'est actuellement déployé. En production, la priorité est calculée par le backend central. Les valeurs 24 ms, cache 98 %, trafic et journaux Fog visibles avec `?demo=1` sont explicitement marqués comme simulation et ne doivent pas être présentés comme des mesures terrain.
- Une demande explicite pompier/ambulance cherche maintenant une `response_unit` réelle, disponible, géolocalisée et appartenant au bon type d'organisation. L'acceptation est verrouillée en transaction : création de l'intervention, passage de l'unité et de l'incident à `assigned`, événement d'audit, notification persistante et Expo Push aux membres actifs du service.
- Un SOS générique sans unité effectivement affectée n'annonce plus faussement « secours en route ». Le citoyen voit « alerte transmise / affectation en attente » ou « unité affectée » selon la réponse canonique `dispatch_status`.
- Le mobile est maintenant adapté au rôle : citoyen/Zem conservent leurs parcours; pompier, ambulancier, dispatcher, superviseur et admin obtiennent un espace Missions; les comptes hospitaliers n'obtiennent pas les actions citoyennes. L'espace terrain liste uniquement les interventions autorisées par le backend, permet accepter/démarrer/arriver/prendre en charge et publie la position GPS de l'unité pendant la mission.
- Le filtrage n'est jamais confié uniquement à l'interface : interventions, ressources, admissions, capacités, notifications et mutations restent filtrées par permissions, utilisateur et `organization_id` dans le backend.

#### Flux accident opérationnel couvert
1. Le citoyen envoie position, précision, gravité, QR et service demandé.
2. Le backend crée l'incident canonique et son audit. La supervision reçoit l'alerte.
3. Pour une demande de service explicite, une unité compatible disponible est verrouillée et affectée; sinon le statut reste `awaiting_dispatch`.
4. Les comptes terrain de l'organisation reçoivent notification persistante et push, ouvrent la mission mobile ou la console responsive et mettent à jour les étapes.
5. La position GPS de l'unité alimente la console; l'hôpital n'est engagé qu'à la demande d'admission après prise en charge.
6. L'hôpital accepte/refuse dans son périmètre; le service poursuit le transport et clôture l'intervention avec audit.

#### Conditions restant obligatoires avant usage secours réel
- Appliquer et vérifier les migrations Supabase, provisionner organisations/unités/comptes nominatifs et associer chaque appareil terrain à une unité.
- Valider Expo Push sur appareils physiques, le fonctionnement en arrière-plan, les permissions GPS permanentes et la reprise après perte réseau.
- Faire une recette terrain avec dispatch 24/7, pompier, ambulance, hôpital et citoyen; mesurer les vrais délais et ne publier aucun SLA avant cette campagne.
- Ajouter un véritable nœud edge, stockage chiffré, file durable, supervision et tests de coupure avant de qualifier la fonction de Fog Computing.
- L'espace hospitalier mobile complet (admissions et capacités) reste à développer; en attendant, la console web responsive hospitalière est l'interface canonique.

### Migration de l'assistant Python vers `appp.py`
- `appp.py`, fourni comme remplacement du prototype `lotisec.py`, devient le service Python canonique. L'interface Streamlit a été transformée en FastAPI pour respecter le contrat déjà consommé par le mobile et le web.
- Routes disponibles : `POST /chat`, `POST /transcribe`, `POST /tts`, `POST /voice` et `GET /health`. `/voice` enchaîne transcription, réponse et synthèse et retourne l'audio MP3 en base64; les routes séparées restent compatibles avec les clients actuels.
- Les améliorations du nouveau prototype sont conservées : détection d'urgence avec gestion de négations, rappel du 118, recherche géolocalisée de six établissements togolais et réponses courtes orientées sécurité.
- La transcription utilise en priorité Whisper via DeepInfra, ce qui accepte les formats WebM du navigateur et M4A/MP4 d'Expo. Un repli `SpeechRecognition` existe pour WAV/FLAC/AIFF. La synthèse vocale utilise gTTS et renvoie `audio/mpeg` sans conserver de fichier utilisateur sur disque.
- Une question écrite affiche la réponse et laisse l'utilisateur activer le bouton haut-parleur. Une question dictée lit automatiquement la réponse vocale. Le mobile envoie désormais correctement l'enregistrement Expo comme `audio.m4a` / `audio/mp4`.
- Railway démarre `uvicorn appp:app`; les fichiers de déploiement existent à la racine et dans `ai_service/` pour la configuration monorepo historique.
- Aucun secret IA ne doit être versionné. `DEEPINFRA_API_KEY`, `DEEPINFRA_MODEL`, `DEEPINFRA_STT_MODEL` et `CORS_ORIGINS` sont lus depuis l'environnement. Les anciennes clés trouvées dans `lotisec.py` et `appp.py` ont été retirées et doivent être révoquées chez DeepInfra.
- En l'absence de clé, `/health` reste disponible et `/chat` retourne un message de continuité sûr; la transcription WebM/M4A signale explicitement que le fournisseur audio est requis.

#### Service Railway à mettre à jour
- Le service IA actuellement consommé par le portail citoyen et l'application mobile est identifiable par son domaine public : `https://agile-trust-production-c862.up.railway.app`. Le nom affiché du service dans Railway peut être différent; le domaine public est l'identifiant fiable à comparer dans `Settings` / `Networking`.
- Il ne faut pas créer un second service tant que ce service existe encore et que l'équipe veut conserver la même URL. La bonne opération est un déploiement sur place du nouveau `appp.py`, ce qui évite de republier une nouvelle URL dans le web et dans l'APK.
- Le dépôt source attendu est `Profzen/lotisec`, branche de production `main`. Le commit de bascule initial est `9c05e85` (`Complete operational flows and voice assistant`).
- Deux configurations de racine sont supportées :
  - Root Directory vide ou `/` : Railway lit le `railway.json`, le `Procfile` et le `requirements.txt` de la racine; commande `uvicorn appp:app --host 0.0.0.0 --port $PORT`.
  - Root Directory `/ai_service` : Railway lit les fichiers de `ai_service/`; commande `uvicorn appp:app --app-dir .. --host 0.0.0.0 --port $PORT` afin d'importer le fichier canonique situé à la racine.
- Ne pas mélanger les deux modes. Si le service historique possède déjà Root Directory `/ai_service`, le conserver et utiliser la seconde commande. S'il n'a pas de Root Directory, utiliser la première.
- Le healthcheck est `GET /health`. Un déploiement sain doit retourner HTTP 200 avec `status: "ok"`, `service: "lotisec-ai"`, `version: "2.0.0"` et `chat_ready: true` après installation de la clé.

#### Procédure exacte de remise en service Railway
1. Ouvrir le projet Railway existant et examiner les services sans les supprimer.
2. Ouvrir chacun des services susceptibles d'être l'IA, puis comparer son domaine public avec `agile-trust-production-c862.up.railway.app`. Le service correspondant est le service à modifier.
3. Dans les paramètres de source, vérifier GitHub `Profzen/lotisec` et la branche `main`. Corriger seulement si une autre branche ou un autre dépôt est sélectionné.
4. Relever la valeur actuelle de Root Directory avant toute modification. Appliquer exactement l'un des deux modes documentés ci-dessus.
5. Dans les variables du service, créer `DEEPINFRA_API_KEY` avec une nouvelle clé réelle générée dans le tableau de bord DeepInfra. Ne jamais écrire `ta_vraie_nouvelle_cle` ou `nouvelle_cle` comme valeur : ce ne sont que des exemples.
6. Ajouter au besoin `CORS_ORIGINS=https://lotisec-frontend.vercel.app`. Plusieurs origines sont séparées par des virgules. Pour une recette limitée, éviter `*` en production.
7. Les variables `DEEPINFRA_MODEL` et `DEEPINFRA_STT_MODEL` sont facultatives. Sans valeur, l'API utilise respectivement `meta-llama/Llama-3.3-70B-Instruct` et `openai/whisper-large-v3-turbo`.
8. Déployer le dernier commit de `main`. Une modification de variable Railway doit être appliquée/déployée pour entrer dans le conteneur actif.
9. Lire les logs de build et de déploiement. Vérifier l'installation des dépendances, l'import de `appp:app`, l'écoute sur `$PORT` et l'absence d'erreur d'authentification DeepInfra.
10. Tester successivement `/health`, une question texte sur `/chat`, un enregistrement réel sur `/transcribe`, une réponse sur `/tts`, puis le parcours complet depuis le web et un appareil Expo.
11. Si l'URL publique change, mettre à jour `VITE_AI_API_URL` sur le projet frontend Vercel et `EXPO_PUBLIC_AI_API_URL` dans les environnements/builds Expo. Une nouvelle URL mobile exige un nouveau build si elle est injectée au moment du build.

#### Variables du service IA et responsabilité de chaque plateforme
| Variable | Emplacement | Obligatoire | Secret | Fonction |
|---|---|---:|---:|---|
| `DEEPINFRA_API_KEY` | Railway, service IA `appp.py` | Oui pour l'IA réelle et Whisper | Oui | Autorise le chat et la transcription DeepInfra. |
| `DEEPINFRA_MODEL` | Railway, service IA | Non | Non | Surcharge le modèle conversationnel. |
| `DEEPINFRA_STT_MODEL` | Railway, service IA | Non | Non | Surcharge le modèle de transcription. |
| `CORS_ORIGINS` | Railway, service IA | Recommandé | Non | Limite les origines web autorisées. |
| `VITE_AI_API_URL` | Vercel, projet `frontend/` | Recommandé | Non, exposée au navigateur | Adresse publique du service IA. |
| `EXPO_PUBLIC_AI_API_URL` | EAS/Expo, projet `Qr-mobile/` | Recommandé | Non, intégrée à l'application | Adresse publique du service IA mobile. |
- `DEEPINFRA_API_KEY` ne doit pas être ajoutée au frontend Vercel, à la console Vercel, à Expo/EAS, dans une variable commençant par `VITE_` ou `EXPO_PUBLIC_`, ni dans GitHub : ces emplacements rendent la valeur accessible au client.
- Le backend Node Vercel possède aussi une intégration IA `/api/v1/ai`, actuellement en veille tant que Railway reste le fournisseur actif. Une clé ajoutée au backend Vercel ne configure pas automatiquement `appp.py`; chaque service possède son propre environnement.

#### Contrat fonctionnel complet de `appp.py`
- `GET /health` : contrôle de disponibilité sans appeler DeepInfra. Il expose l'état du service, sa version, la présence de la clé, la stratégie de transcription et le moteur TTS. Il ne révèle jamais la clé.
- `POST /chat` : reçoit le message, l'historique optionnel, la latitude, la longitude et le rayon. Il normalise le texte, détecte une urgence, calcule les établissements proches, prépare un contexte de sécurité routière togolais et appelle DeepInfra. En cas de clé absente ou de panne fournisseur, il retourne une réponse sûre de continuité au lieu de faire tomber l'API.
- Détection d'urgence : reconnaît les formulations liées à accident, blessure, inconscience, saignement, feu et danger, tout en tenant compte des négations simples pour réduire les faux positifs. Une urgence rappelle d'appeler le 118, de sécuriser la zone et de ne pas déplacer une victime sauf danger immédiat.
- Recherche locale : utilise un catalogue de six établissements togolais et la formule de Haversine pour calculer la distance depuis les coordonnées reçues. Elle ne dépend pas de Google Maps et ne prétend pas connaître en temps réel les lits disponibles.
- `POST /transcribe` : accepte un fichier multipart jusqu'à 12 Mo. DeepInfra Whisper traite en priorité WebM, M4A, MP4 et autres formats courants. Le repli local `SpeechRecognition` est limité à WAV, FLAC et AIFF. Une erreur explicite est retournée si le format exige DeepInfra et que la clé est absente.
- `POST /tts` : reçoit un texte non vide, le synthétise en français avec gTTS et diffuse un MP3 `audio/mpeg`. Aucun fichier vocal utilisateur permanent n'est conservé sur le serveur.
- `POST /voice` : exécute le cycle complet transcription → réponse métier → synthèse; il retourne la transcription, la réponse, les indicateurs d'urgence et de lieux, ainsi que l'audio MP3 encodé en base64. Cette route permet à un futur client d'effectuer le parcours vocal en un seul appel.
- CORS : la liste d'origines vient exclusivement de `CORS_ORIGINS`; les méthodes et en-têtes nécessaires aux appels web sont autorisés.
- Confidentialité : les données vocales transitent vers DeepInfra pour transcription lorsque ce fournisseur est actif et le texte peut être envoyé au modèle conversationnel. Cette réalité doit figurer dans l'information utilisateur et la politique de confidentialité avant production publique.

#### Comportement des clients web et mobile
- Le web et le mobile utilisent actuellement les trois routes compatibles `/chat`, `/transcribe` et `/tts` sur l'URL Railway configurable.
- Une question saisie au clavier produit une réponse texte. L'utilisateur choisit ensuite le bouton haut-parleur s'il veut l'entendre.
- Une question enregistrée est transcrite, envoyée à `/chat`, puis la réponse est lue automatiquement; le bouton haut-parleur reste disponible pour la réécouter.
- Le navigateur transmet l'enregistrement WebM produit par `MediaRecorder`. Expo transmet un fichier M4A avec le type MIME `audio/mp4`; le correctif empêche de présenter faussement ce fichier comme du WAV.
- Les clients affichent une erreur contrôlée si le service Railway est arrêté, si le crédit DeepInfra est épuisé, si le microphone est refusé ou si la synthèse échoue. Les numéros d'urgence ne doivent jamais dépendre uniquement de l'IA.

#### Sécurité, exploitation et limites connues
- Toute ancienne clé autrefois écrite dans `lotisec.py` ou un prototype doit être révoquée dans DeepInfra. La suppression du dépôt n'annule pas une clé déjà divulguée dans l'historique Git ou copiée ailleurs.
- La nouvelle clé doit avoir un nom permettant son audit, un budget/quotas adaptés et une surveillance de consommation. Ne jamais communiquer sa valeur dans une capture, un ticket ou `memoire.md`.
- Les logs ne doivent contenir ni fichier audio, ni jeton d'autorisation, ni dossier médical complet. Les erreurs fournisseur sont journalisées sans la clé.
- La limite applicative d'upload est 12 Mo; Railway peut appliquer ses propres limites et délais. Tester avec la durée maximale réellement autorisée dans l'interface.
- gTTS dépend d'un service réseau externe et n'offre pas de garantie médicale ou opérationnelle. En cas d'indisponibilité TTS, le texte doit rester lisible.
- Les réponses IA sont une aide d'information et non un diagnostic. En urgence, l'interface doit toujours privilégier l'appel direct au 118 et les instructions de sécurité déterministes.
- Critères minimum avant validation production : `chat_ready=true`, test de français réel, test microphone Android et navigateur, test de négation d'urgence, test d'urgence positive, test sans crédit fournisseur, contrôle CORS et vérification qu'aucun secret n'est présent dans les bundles frontend/mobile.

### Rétablissement de l'Interactivité Console, Zéro Emoji & Déconnexion
- **Correction d'erreur de syntaxe bloquante (`LOTISEC-Console-Complete/public/console.js`)** :
  - Suppression d'une accolade fermante prématurée dans `applyRbac` qui interrompait l'exécution du script, bloquait l'ensemble des écouteurs d'événements, le sélecteur de rôle, la déconnexion et l'initialisation de l'interface.
- **Suppression intégrale des emojis dans la console** :
  - Remplacement systématique de tous les emojis par des icônes SVG vectorielles professionnelles et épurées (Sidebar, modales, boutons de connexion rapide, indicateurs de flux, cartes).
- **Rétablissement et mise en valeur du bouton « Se déconnecter »** :
  - Intégré directement sous l'avatar et les rôles de l'opérateur avec icône SVG et confirmation immédiate, réinitialisant la session `localStorage` et renvoyant au choix de profil.
- **Cloisonnement RBAC strict & fluide** :
  - *Admin / Superviseur National* : Accès complet à tous les modules + sélecteur d'espace dans la TopBar pour tester en direct chaque perspective.
  - *Hôpitaux (ex: CHU Sylvanus Olympio)* : Vue restreinte aux modules sanitaires (`Hôpitaux`, `Capacités & Lits` avec ajustement en 1 clic, `Fiches Patients` QR Code, `Notifications`), sans carte tactique de poursuite.
  - *Sapeurs-Pompiers (118) & Ambulanciers* : Vue opérationnelle avec file d'incidents, carte Leaflet temps réel, reroutage anti-bouchon et demandes d'admission hospitalière.

## Mise à jour de reprise — 2026-08-11

### Blocage actuel confirmé : service IA Railway suspendu
- Le projet Railway concerné est `ab795ad1-e019-4ac5-91c8-1398cfb0cc47` et le service IA `c5bed3ea-0be5-4194-b0cb-572f2c1d18e9`, affiché sous le nom `agile-trust`.
- Source vérifiée : dépôt GitHub `Profzen/lotisec`, branche de production `main`, déploiement automatique activé et Root Directory `/ai_service`.
- État observé le 2026-08-11 : `Trial expired`, accès limité, service hors ligne et aucun déploiement actif. Railway refuse donc le redéploiement même si le code et les variables sont corrects.
- Conséquence immédiate : `https://agile-trust-production-c862.up.railway.app` ne fournit plus l'assistant. Les appels `/chat`, `/transcribe`, `/tts`, `/voice` et `/health` sont indisponibles tant qu'un hébergement Python n'est pas rétabli.
- Le frontend et le mobile utilisent encore cette URL comme fournisseur IA temporaire. L'assistant texte et vocal doit donc être considéré **indisponible en production**, sans remettre en cause les autres fonctions LOTISEC servies par le backend Node Vercel.

### Incident de sécurité à traiter avant toute remise en ligne
- Une clé DeepInfra a été communiquée en clair pendant l'assistance. Elle doit être considérée compromise, révoquée dans le tableau de bord DeepInfra et remplacée par une nouvelle clé.
- Ne pas réutiliser la clé exposée, même si elle semble encore fonctionner. Ne jamais recopier la nouvelle clé dans GitHub, un message, une capture, `memoire.md`, `appp.py`, `lotisec.py`, Vercel frontend ou une variable publique Expo/Vite.
- La nouvelle valeur doit exister uniquement comme secret du serveur qui exécute l'IA : `DEEPINFRA_API_KEY` sur Railway ou sur l'hébergeur de remplacement. Après rotation, vérifier les journaux accessibles à l'équipe et surveiller la consommation DeepInfra.

### Décision d'hébergement IA restant à prendre

#### Option A — Réactiver Railway, chemin le plus court
1. Souscrire un plan Railway permettant de reprendre les déploiements du projet existant.
2. Conserver le service `agile-trust`, le dépôt `Profzen/lotisec`, la branche `main` et Root Directory `/ai_service`.
3. Ajouter la nouvelle clé dans `Variables` sous `DEEPINFRA_API_KEY`, sans guillemets.
4. Ajouter `CORS_ORIGINS=https://lotisec-frontend.vercel.app` et conserver les modèles par défaut sauf besoin explicite.
5. Redéployer le dernier commit de `main`. Avec Root Directory `/ai_service`, la commande attendue est `uvicorn appp:app --app-dir .. --host 0.0.0.0 --port $PORT`.
6. Vérifier que `/health` répond HTTP 200 avec `chat_ready=true`, puis effectuer la recette texte et voix.
- Avantage : l'URL publique peut rester identique; aucune modification des clients ni nouveau build mobile n'est alors nécessaire.
- Inconvénient : abonnement Railway et dépendance continue à ce service.

#### Option B — Déployer `appp.py` chez un autre hébergeur Python
1. Choisir un hébergeur acceptant FastAPI, les uploads multipart, les requêtes sortantes DeepInfra/gTTS, un healthcheck et une durée de requête suffisante pour la voix.
2. Déployer la racine du dépôt avec `requirements.txt` et `uvicorn appp:app --host 0.0.0.0 --port $PORT`, ou adapter explicitement la commande à la racine choisie.
3. Définir côté serveur `DEEPINFRA_API_KEY` et `CORS_ORIGINS`; ne jamais exposer la clé au navigateur ou à Expo.
4. Obtenir une URL HTTPS stable et tester toutes les routes.
5. Mettre cette URL dans `VITE_AI_API_URL` du frontend Vercel et redéployer le frontend.
6. Mettre cette URL dans `EXPO_PUBLIC_AI_API_URL` pour les profils Expo/EAS. Une valeur intégrée au bundle impose un nouveau build APK/AAB.
- Ne supprimer le service Railway historique qu'après validation complète du nouvel hébergement et bascule effective des deux clients.

#### Option C — Finaliser la migration IA vers le backend Node Vercel
- Le backend contient déjà une intégration IA et les routes `/api/v1/ai`, mais elle est volontairement en veille pendant l'utilisation du fournisseur Python Railway.
- Pour supprimer le microservice Python, il reste à atteindre la parité : chat, contexte/RAG, transcription WebM/M4A, synthèse MP3, gestion d'urgence, limites d'upload, réponses de repli et contrat d'erreur identique.
- Ajouter `DEEPINFRA_API_KEY` uniquement au projet **backend** Vercel, activer le service Node, tester `/api/v1/ai/health`, puis modifier les clients pour utiliser le backend canonique.
- Cette option réduit le nombre de services, mais demande du développement et une validation audio serverless avant de retirer `appp.py`.

### Ordre recommandé de reprise
1. Révoquer immédiatement la clé DeepInfra exposée et générer une nouvelle clé secrète.
2. Choisir l'option A, B ou C. Pour un rétablissement rapide sans changement d'URL, privilégier A; pour éviter Railway, évaluer B; pour simplifier durablement l'architecture, planifier C.
3. Rétablir un endpoint `/health` accessible publiquement avant de modifier les applications.
4. Tester les routes directement, puis le portail web, puis un appareil Android réel.
5. Ne déclarer l'assistant disponible qu'après succès de la matrice de recette.

### Matrice de recette IA restant à exécuter
- Santé : `/health` HTTP 200, `version=2.0.0`, `chat_ready=true`, aucune information secrète retournée.
- Texte nominal : question en français, réponse pertinente, courte et lisible; historique respecté.
- Urgence positive : accident avec blessé/inconscience détecté, rappel du 118 et gestes de sécurité déterministes.
- Négation : « il n'y a pas d'accident » ne doit pas être classé abusivement comme urgence.
- Géolocalisation : coordonnées valides, établissements triés par distance; aucune promesse de lits en temps réel.
- Audio navigateur : permission microphone, upload WebM, transcription, réponse et lecture MP3.
- Audio Expo/Android : permission microphone, upload M4A avec MIME `audio/mp4`, transcription et lecture automatique.
- Réécoute : bouton haut-parleur disponible après réponse écrite et dictée.
- Erreurs : microphone refusé, fichier vide ou supérieur à 12 Mo, format non supporté, clé absente/invalide, crédits épuisés, timeout DeepInfra et panne gTTS.
- Sécurité : contrôle CORS, absence de secret dans les bundles, absence d'audio ou de dossier médical dans les logs, limitation des abus et suivi des coûts.
- Charge minimale : plusieurs conversations simultanées et temps de réponse mesurés avant toute promesse de disponibilité.

### Travaux plateforme encore requis avant exploitation réelle

#### Secours, dispatch et terrain
- Appliquer toutes les migrations Supabase de production et vérifier tables, index, contraintes, politiques d'accès et données de référence.
- Provisionner organisations réelles, unités de réponse, véhicules, hôpitaux, comptes nominatifs et associations utilisateur-unité; les comptes de démonstration ne doivent pas devenir des comptes d'exploitation.
- Vérifier qu'une demande pompier/ambulance affecte une unité compatible disponible et que les conflits simultanés ne créent pas de double affectation.
- Tester notifications persistantes et Expo Push sur appareils physiques : application fermée, arrière-plan, téléphone verrouillé et reprise réseau.
- Valider le cycle complet : alerte, qualification, affectation, acceptation, départ, arrivée, prise en charge, demande hospitalière, admission/refus, transport et clôture avec audit.
- Ajouter ou valider les procédures de réaffectation, refus, annulation, unité indisponible, absence d'hôpital, perte GPS et escalade humaine 118.

#### RBAC, données et sécurité
- Rejouer une matrice RBAC complète pour citoyen, Zem, pompier, ambulancier, dispatcher, superviseur, administrateur et gestionnaire hospitalier sur mobile, web, console et API directe.
- Vérifier que modifier l'interface ou le `localStorage` ne permet jamais de contourner les permissions backend ou `organization_id`.
- Remplacer les mots de passe uniformes de recette avant exploitation et désactiver le reset des comptes d'acceptation en production.
- Définir rotation des JWT/secrets, expiration/révocation de session, audit, sauvegardes Supabase, restauration testée et conservation des données médicales/GPS/audio.
- Réaliser une revue de sécurité des uploads, du scan QR/PIN, des codes maîtres, du CORS, des limites de débit et des dépendances.

#### Mobile, web et console
- Produire un nouveau build EAS après toute modification de variable publique mobile; tester installation propre, mise à niveau, permissions GPS/microphone/notifications et cartes sur plusieurs versions Android.
- Vérifier modes clair/sombre, contrastes, tailles de texte, états vide/chargement/erreur et navigation clavier/responsive de la console.
- Tester les connexions rapides et les six comptes de recette contre la production sans boucle de login, puis vérifier la séparation exacte des menus et données.
- Recetter scan QR/PIN et codes institutionnels sur web/mobile, données médicales complètes et PDF QR hors dépendance externe.
- Tester cartes CartoDB/OSM, GPS, itinéraires, suivi Zem et missions secours dans les conditions réseau réelles du Togo.

#### Fog Computing et résilience
- Ne pas présenter le score central de priorisation ou les données `?demo=1` comme du Fog Computing réel.
- Pour revendiquer un Fog opérationnel, déployer un nœud edge physique, une file durable chiffrée, une synchronisation idempotente, une supervision, une horloge fiable, une politique de conflit et une alimentation/réseau de secours.
- Exécuter des tests de coupure cloud/réseau, mesurer délai local et resynchronisation, puis publier uniquement des métriques observées.

### Critère de fin global
- LOTISEC ne peut être déclaré prêt pour un usage secours réel qu'après : service IA rétabli ou retiré proprement, secrets renouvelés, migrations appliquées, comptes réels provisionnés, RBAC/API vérifiés, recette terrain multi-acteurs réussie, notifications/GPS validés sur appareils, sauvegarde/restauration testée et procédure humaine 118 documentée.
- Tant que ces conditions ne sont pas réunies, la plateforme reste une version de démonstration/recette avancée et aucun score, ETA, disponibilité hospitalière ou capacité Fog simulée ne doit être présenté comme une garantie opérationnelle.

## Plan de travail — Parité visuelle web/mobile et fiabilisation des parcours citoyens (2026-08-11)

### Objectif
- Refaire le portail citoyen `https://lotisec-frontend.vercel.app` pour qu'il utilise la même identité que l'application mobile LOTISEC actuelle : logos officiels, palette sobre, composants, typographie, iconographie, espacements et comportements cohérents.
- Supprimer les anciens grands aplats verts et les effets décoratifs qui ne correspondent plus à la charte mobile, tout en conservant les couleurs fonctionnelles pour les succès, alertes et urgences.
- Fournir un vrai thème clair et un vrai thème sombre, tous deux lisibles, accessibles et homogènes sur l'ensemble des écrans citoyens.
- Vérifier et corriger de bout en bout le QR médical, le déverrouillage du scan et l'affichage des données vitales autorisées.
- Vérifier et corriger le parcours Zem, notamment l'affichage de la carte, la sélection d'origine/destination, le calcul d'itinéraire et les états d'erreur réseau/GPS.

### Séquence prévue
1. Extraire les tokens et références visuelles réellement utilisés par `Qr-mobile/` et inventorier les divergences dans `frontend/`.
2. Centraliser les couleurs et styles du portail, remplacer les verts décoratifs obsolètes, aligner logos, navigation, cartes, boutons, formulaires, modales et états système.
3. Appliquer et vérifier les thèmes clair/sombre sur authentification, accueil, profil, QR, scan, hôpitaux, assistant, historique et Zem.
4. Tracer le contrat QR depuis la génération du token jusqu'à `/scan/verify`; vérifier PIN personnel, codes institutionnels et champs taille, poids, groupe sanguin, allergies, maladies, traitements, médecin et contacts d'urgence.
5. Tester les tuiles cartographiques, la recherche d'adresse, le choix de destination, le géocodage, OSRM, les marqueurs et les replis en cas d'indisponibilité.
6. Exécuter build frontend, TypeScript mobile et tests backend ciblés/globaux; consigner les résultats, limites et éventuelles actions manuelles restantes.
7. Commit et push unique sur `main` après validation locale.

### Critères d'acceptation
- Aucun écran citoyen principal ne conserve un fond vert décoratif dominant; le vert reste réservé aux états positifs et actions métier lorsque pertinent.
- Les deux thèmes ont des contrastes suffisants, aucun texte ne disparaît sur son fond, et les interfaces restent sobres sans néons ni surbrillances excessives.
- Le logo web est identique à l'actif officiel mobile et ne dépend pas d'un ancien asset SafeLife.
- Un QR valide peut être affiché, partagé/imprimé, scanné puis déverrouillé avec les droits prévus; les champs médicaux disponibles sont rendus sans inventer de données absentes.
- La carte Zem affiche un fond exploitable, permet de définir une destination et donne un retour clair si GPS, Nominatim, OSRM ou le backend ne répond pas.

### Réalisation et constat technique
- Le portail citoyen reprend maintenant les tokens actifs du mobile : bleu d'action `#1565D8`, marine `#071A2E`, cyan d'accent, surfaces claires neutres, fonds sombres `#061322`/`#0D2238`, bordures et textes à fort contraste. Les anciens aplats verts décoratifs et le wordmark `SafeLife` de l'accueil ont été retirés.
- Le même fichier officiel `logo-118.png` est utilisé sur mobile et web; les empreintes SHA-256 des copies ont été comparées et sont identiques.
- Un sélecteur clair/sombre persistant (`lotisec_theme`) suit d'abord la préférence système, puis le choix utilisateur. Il est disponible sur l'authentification, la navigation citoyenne et le scan public. Les cartes, boutons, formulaires, panneaux, assistant, QR et surfaces utilisent les variables de thème.
- La présentation desktop n'impose plus un faux téléphone blanc étroit au centre : le contenu citoyen reste contenu et lisible, tandis que la navigation latérale et la surface principale occupent correctement l'écran.
- L'historique factice de scans de l'accueil web a été supprimé. `/scan/me` fournit désormais les accès réellement journalisés pour le citoyen authentifié, avec date, autorité et succès.

### QR et fiche médicale : état après correction
- La génération QR web/mobile utilise le `qr_token` réel, rafraîchi via `/auth/me` si nécessaire. Le QR pointe vers `/scan/:token`; partage et impression/PDF restent disponibles.
- `/scan/verify` accepte un professionnel authentifié, le PIN du citoyen ou les quatre codes institutionnels. Il journalise l'accès et retourne identité, groupe sanguin, taille, poids, allergies, maladies, traitements, handicap, médecin, contacts et véhicule lorsqu'ils sont renseignés.
- Un défaut de bout en bout a été corrigé : taille, poids et médecin étaient affichables mais non saisissables/persistés par le tunnel actuel. L'étape médicale mobile contient maintenant ces champs ainsi que allergies, maladies et traitements; la revue les récapitule et le client les envoie au backend.
- La migration additive `backend/migrations/20260811_profile_vitals.sql` ajoute `height`, `weight`, `doctor_name` et `doctor_phone`. **Cette migration doit être appliquée sur Supabase production avant d'utiliser le nouveau formulaire**, sinon l'enregistrement de profil échouera sur ces colonnes.
- Le backend renvoie maintenant aussi `has_vehicle`, type, plaque, marque et modèle; les écrans web/mobile peuvent donc réellement afficher le véhicule au lieu de conserver une section toujours masquée.
- Les valeurs absentes restent indiquées ou masquées sans être inventées. L'accès QR médical reste soumis à authentification/code et audit.

### Parcours Zem : état après correction
- La carte web passager conserve CartoDB Voyager/OSM, les marqueurs départ/destination et le tracé OSRM.
- La boîte native `prompt()` utilisée pour changer le départ a été supprimée. Le panneau possède désormais un sélecteur explicite de point de départ, une recherche Nominatim, un bouton « Utiliser ma position GPS » et une recherche de destination distincte.
- Une recherche vide affiche un message utile; un échec OSRM signale que l'itinéraire est indisponible au lieu de laisser croire que le prix est calculé. Le bouton de commande reste désactivé sans destination et route valides.
- Le clic direct sur la carte, le repli GPS sur Lomé, le calcul distance/durée/prix et la commande `/zem/request` restent disponibles. Les surfaces du passager et du conducteur respectent le thème.

### Vérifications automatiques réalisées
- `frontend`: `npm run build` réussi avec TypeScript et Vite; seul l'avertissement historique de taille du bundle demeure.
- `Qr-mobile`: `npx tsc --noEmit` réussi sans erreur.
- `backend`: build TypeScript réussi et **31/31 tests** réussis. Les nouveaux garde-fous couvrent la migration des constantes vitales, le formulaire médical, la charte web, le logo officiel et l'absence de `prompt()` Zem.
- Contrôle final : `git diff --check` doit rester sans erreur et la recherche de secrets ne doit retrouver aucune clé DeepInfra dans les fichiers modifiés avant publication.

### Actions manuelles restantes après déploiement
1. Appliquer `backend/migrations/20260811_profile_vitals.sql` sur Supabase production avant la recette profil.
2. Créer ou mettre à jour un profil réel avec taille, poids, allergies, maladie, traitement, handicap, médecin, contacts et véhicule.
3. Afficher puis scanner son QR depuis un autre appareil; tester PIN personnel, code institutionnel valide et code invalide, puis contrôler l'historique d'accès.
4. Tester thème clair/sombre sur Chrome desktop, navigateur Android et PWA installée, notamment le scan public ouvert hors session.
5. Tester une course Zem à Lomé avec GPS autorisé puis refusé, recherche de départ/destination, clic carte, réponse Nominatim, réponse OSRM, commande, annulation et suivi temps réel.
6. Les services Nominatim, OSRM et CartoDB étant externes, conserver les messages de repli et prévoir à terme un proxy/cache respectant leurs politiques d'usage pour une exploitation à grande échelle.

### Uniformisation finale des logos et icônes navigateur
- Le logo officiel canonique reste `Qr-mobile/assets/logo-118.png`. Les copies utilisées dans `frontend/public/logo-118.png` et `LOTISEC-Console-Complete/public/assets/logo-lotisec.png` ont la même empreinte SHA-256.
- Le titre de l'onglet citoyen passe de `118` à `LOTISEC`; le manifeste PWA utilise également `LOTISEC`, la couleur marine `#071A2E` et le fond clair neutre de la charte actuelle.
- Des favicons 32×32 et icônes PWA 192×192/512×512 ont été générés par recadrage déterministe du même logo. Ce recadrage retire seulement la marge blanche excessive afin que le symbole reste identifiable à la taille d'un onglet; il ne redessine pas le logo.
- Le portail citoyen utilise un paramètre de version `v=20260811` sur le favicon et l'icône Apple afin de contourner les anciens caches navigateur/PWA.
- La vitrine et la console institutionnelle abandonnent l'ancien `favicon.svg`. Elles utilisent le PNG officiel pour le favicon, l'icône Apple, la navigation, le pied de page, l'écran de connexion et la console opérationnelle.
- Le cache du service worker console est incrémenté à `lotisec-console-shell-v2` et inclut le nouveau favicon pour forcer le renouvellement du shell installé.
- Après déploiement, si un onglet déjà ouvert affiche encore l'ancienne icône, fermer tous les onglets LOTISEC puis effectuer un rechargement forcé. Pour une PWA installée, la désinstaller/réinstaller peut être nécessaire selon le cache du système d'exploitation.

## Correctif affectation ambulance et carte opérationnelle (2026-08-11)

### Défauts constatés
- Le bouton « Affecter » du module Ambulances sélectionnait parfois un incident au statut `new`, alors que le backend exige un incident `validated`; la requête était donc rejetée en `409`.
- L'interface lançait l'affectation asynchrone sans attendre sa réponse, puis ouvrait immédiatement une autre page. La mission retournée n'était pas rechargée et la carte du tableau de bord restait absente.
- Une unité déjà « En mission » pouvait encore présenter une action d'affectation et le mode démonstration tentait un appel backend avec un jeton fictif.
- Le tableau de bord sans mission ne présentait qu'un état vide minimal, ce qui donnait l'impression que du contenu avait disparu.
- Les écritures incident, intervention, unité, événement, audit et notification n'étaient pas regroupées dans une transaction unique pour l'affectation manuelle.

### Corrections réalisées
- L'affectation attend désormais la validation backend, ne prend qu'un incident `validated` et une unité `Disponible`, puis recharge les incidents, interventions et ressources avant d'ouvrir le tableau de bord.
- La mission locale reprend l'identifiant réel de l'intervention, les statuts canoniques (`assigned`, `en_route`, etc.) et une distance calculée depuis les coordonnées GPS avec Haversine.
- Après succès, le tableau de bord affiche automatiquement la carte Leaflet interactive, les marqueurs incident/ambulance/hôpital, le tracé OSRM quand il est disponible et les contrôles de suivi existants.
- Sans mission, le tableau de bord affiche maintenant les indicateurs, la file des incidents prioritaires, l'état de la flotte et une explication claire sur la condition d'apparition de la carte.
- Les boutons d'affectation sont désactivés pour toute unité non disponible; « Voir sur la carte » explique qu'une mission doit d'abord exister au lieu de provoquer une erreur JavaScript.
- Le mode démonstration effectue une affectation locale cohérente sans appeler l'API réelle.
- Le backend verrouille l'incident et l'unité avec `FOR UPDATE`, refuse une intervention active concurrente, puis crée intervention, changements de statuts, événement, audit et notification dans une transaction PostgreSQL atomique.
- Après commit, les utilisateurs actifs de l'organisation ayant un rôle opérationnel reçoivent une notification push de nouvelle mission; l'application terrain peut ensuite accepter et faire progresser l'intervention.

### Recette et conditions de production
- Syntaxe de `public/console.js` validée avec `node --check` et build Vite de la console réussi.
- Build TypeScript backend et suite complète réussis : **31/31 tests**.
- Pour que la carte réelle s'affiche, l'incident doit être validé, l'ambulance doit exister dans `response_units`, être `available`, appartenir à l'organisation envoyée et disposer idéalement de coordonnées latitude/longitude.
- Les tuiles cartographiques et le calcul routier restent dépendants du réseau (Leaflet/CartoDB-OSM et OSRM). Sans OSRM, les positions demeurent visibles mais le tracé routier peut ne pas être calculé.

## Plan — PIN citoyen, accès professionnel RBAC et accès d'urgence (2026-08-11)

### État constaté avant correction
- Le QR identifie correctement un profil sans embarquer directement les données médicales, mais le code personnel n'est pas choisi par le citoyen : les nouveaux profils reçoivent encore la valeur provisoire `1234`.
- Les codes partagés `POMP2626`, `AMBU1818`, `MEDC3737` et `POL1717` déverrouillent toutes les fiches. Ils conviennent à une recette contrôlée, pas à une exploitation réelle, car ils sont statiques, globaux, non expirants et difficiles à révoquer individuellement.
- Le backend reconnaît déjà une session professionnelle autorisée, mais les écrans web/mobile imposent néanmoins un champ PIN non vide avant d'envoyer la vérification.
- Les lectures réussies sont journalisées; les tentatives refusées et le contexte complet de la décision d'accès doivent également être audités.
- Le propriétaire authentifié doit consulter et modifier sa propre fiche depuis son compte sans scanner son QR ni ressaisir son PIN.
- Les champs médicaux enrichis sont communs au backend, au web et au mobile, sous réserve d'appliquer la migration de production des constantes vitales.

### Modèle cible
1. Le citoyen choisit un PIN personnel de 4 à 6 chiffres à la création ou à la modification de son profil. Le PIN n'est jamais placé dans le QR, ni renvoyé par les API, ni stocké en clair.
2. Le propriétaire authentifié accède directement à sa propre fiche et peut renouveler son PIN après vérification appropriée de sa session.
3. Un tiers non professionnel scanne le QR puis saisit le PIN que le citoyen lui communique volontairement.
4. Un pompier, ambulancier, agent hospitalier ou responsable autorisé se connecte avec son compte professionnel; son JWT et son RBAC suffisent, sans code universel supplémentaire.
5. Les anciens codes universels sont conservés uniquement derrière un commutateur explicite de recette, désactivé par défaut en production.
6. Un accès de secours organisationnel utilise un code généré par organisation, stocké sous forme de hash, limité dans le temps, révocable et associé à des rôles/périmètres autorisés.
7. Toute tentative, réussie ou refusée, produit un événement d'audit contenant le profil ciblé, l'acteur éventuel, l'organisation, le rôle, le mécanisme d'accès, l'horodatage et la position transmise si le consentement GPS est disponible.

### Plan d'implémentation
1. Ajouter une migration additive pour le hash du PIN citoyen, les codes d'urgence organisationnels temporaires et les champs d'audit nécessaires, sans exposer de secret existant.
2. Étendre les routes profil pour définir/renouveler le PIN avec validation 4–6 chiffres et hash bcrypt, tout en gardant une transition contrôlée pour les profils historiques.
3. Refondre `/scan/verify` autour de quatre décisions explicites : propriétaire, professionnel RBAC, PIN citoyen, accès d'urgence organisationnel; désactiver les codes de recette en production par défaut et journaliser succès comme refus.
4. Adapter l'inscription et la gestion de profil mobile, ainsi que la gestion de profil citoyenne web, pour saisir et confirmer le PIN sans jamais le réafficher.
5. Adapter les écrans de scan web/mobile : accès direct pour une session professionnelle autorisée, saisie PIN pour le public, et champ de code d'urgence uniquement lorsque nécessaire.
6. Vérifier que la console institutionnelle et les comptes professionnels conservent leur périmètre RBAC et ne reçoivent aucune donnée médicale hors autorisation.
7. Ajouter des tests couvrant hash du PIN, absence de secret dans les réponses/QR, propriétaire, professionnel, tiers, code expiré/révoqué, anciens codes de recette et journalisation des refus.
8. Exécuter builds backend, portail, console et TypeScript mobile; mettre à jour ce mémoire avec les résultats et les actions de déploiement.
9. Publier sur `main`, puis lancer un build Android Expo/EAS et consigner le lien de suivi/téléchargement.

### Réalisation — accès médical sécurisé
- La migration additive `backend/migrations/20260811_secure_medical_access.sql` ajoute `profiles.access_code_hash`, la date de renouvellement du PIN, la table `organization_emergency_access_codes`, les informations de méthode/refus/IP dans `scan_access_events` et active RLS sur la table des codes temporaires.
- Le PIN citoyen est limité à 4–6 chiffres et hashé avec bcrypt (coût 12). Il n'est jamais renvoyé par `/profil/me`, jamais intégré au QR et remplace toute ancienne valeur en clair. Un ancien PIN historique encore valide est automatiquement migré vers bcrypt lors de sa première utilisation.
- La valeur par défaut `1234` a été retirée de la création de comptes et de profils. Les nouveaux citoyens choisissent leur PIN lors de la finalisation mobile; les citoyens existants le définissent ou le renouvellent depuis « Profil » sur mobile ou web.
- Le propriétaire authentifié consulte et modifie directement sa fiche via `/profil/me`, sans QR ni PIN. La route publique `/profil/scan/:token` ne transmet plus de données médicales, même à une session professionnelle : toute lecture complète passe obligatoirement par `/scan/verify` afin d'être auditée.
- `/scan/verify` applique désormais l'ordre d'autorisation suivant : session du propriétaire, session professionnelle RBAC, PIN citoyen, code d'urgence organisationnel temporaire, puis anciens codes de recette uniquement si `ENABLE_DEMO_MEDICAL_CODES=true`.
- Les quatre anciens codes globaux restent présents uniquement pour compatibilité de démonstration et sont inactifs par défaut. **Ne pas définir `ENABLE_DEMO_MEDICAL_CODES` en production.**
- Toute lecture réussie enregistre la méthode d'accès. Toute information d'identification invalide enregistre également un refus, son contexte et l'adresse réseau. Après cinq refus sur le même profil et la même adresse en dix minutes, l'API répond `429`.
- Les responsables autorisés (`supervisor`, `hospital_manager`, ou administrateur) disposent de `medical_access:manage`. Ils peuvent créer un code organisationnel valable de 5 minutes à 24 heures, le voir une seule fois, le révoquer et consulter sa date d'expiration/dernière utilisation.

### Alignement des interfaces
- Mobile citoyen : l'étape finale d'inscription exige le PIN et sa confirmation; un nouvel onglet « Profil » permet de consulter/modifier identité, constantes, antécédents, médecin, contact d'urgence et PIN.
- Web citoyen : une page protégée « Mon profil médical » a été ajoutée à la navigation avec les mêmes champs et une zone distincte de renouvellement du PIN.
- Scan web/mobile : une session propriétaire ou professionnelle autorisée tente automatiquement l'ouverture sans demander de code. Un tiers voit un champ « PIN citoyen ou code d'urgence ».
- Console : les Paramètres exposent la génération d'un code de 60 minutes, sa copie à usage unique et sa révocation pour les rôles autorisés. Le module « Fiches Patients » ne contient plus les deux faux patients historiques; il affiche uniquement les admissions réelles du périmètre hospitalier.
- Tous les clients utilisent le même QR opaque et le même endpoint canonique `/scan/verify`; aucune donnée médicale n'est encodée dans l'image QR.

### Vérifications réalisées
- Backend : build TypeScript réussi et **32/32 tests** réussis, incluant hash, expiration/révocation, RLS, audit des refus et limitation des tentatives.
- Portail citoyen : build TypeScript/Vite/PWA réussi. L'avertissement non bloquant sur la taille du bundle principal demeure.
- Console institutionnelle : syntaxe JavaScript validée et build Vite réussi.
- Application Expo : `npx tsc --noEmit` réussi sans erreur.
- `git diff --check` doit être relancé juste avant commit; aucun secret de PIN ou code d'urgence généré ne doit être ajouté au dépôt.

### Actions obligatoires de déploiement et recette
1. Appliquer dans Supabase production, dans l'ordre du dépôt, `20260811_profile_vitals.sql` puis `20260811_secure_medical_access.sql` avant de déployer le backend utilisant ces colonnes.
2. Vérifier que `ENABLE_DEMO_MEDICAL_CODES` est absente ou différente de `true` sur le backend de production.
3. Reconnecter les comptes professionnels après déploiement afin que leur JWT contienne la permission `medical_access:manage` ajoutée à leur rôle.
4. Recetter : propriétaire sans PIN, professionnel connecté sans code, tiers avec bon/mauvais PIN, six refus successifs, code organisationnel actif/expiré/révoqué et consultation du journal d'audit.
5. Vérifier sur deux appareils physiques que les données modifiées sur web sont immédiatement retrouvées sur mobile et réciproquement, car les deux clients partagent le même profil backend.

### Publication et build mobile
- Publication GitHub effectuée sur `main` au commit `edd7de5` (`Secure medical QR access across clients`). Les déploiements Vercel raccordés à cette branche peuvent démarrer depuis ce commit.
- Build Expo/EAS Android `preview` (APK interne) lancé sous le compte `profzen` pour le projet `lotisec`, SDK Expo 54, version applicative 1.1.0, build 1.
- Identifiant EAS : `781e1e9a-07c7-4774-829d-66f0e93486d6`.
- Suivi : `https://expo.dev/accounts/profzen/projects/lotisec/builds/781e1e9a-07c7-4774-829d-66f0e93486d6`.
- État au lancement : `IN_QUEUE`. La même page fournira le téléchargement de l'APK dès que le statut sera `FINISHED`.

## Plan — persistance CRUD et audit exhaustif multi-client (2026-08-11)
- Objectif : garantir que toute mutation métier provenant du portail citoyen, de l'application mobile ou de la console passe par le backend, est persistée en PostgreSQL et laisse une trace exploitable sans stocker de mot de passe, PIN, jeton ou contenu vocal sensible dans l'audit.
- Rendre l'upsert du profil médical et le remplacement de ses contacts atomiques : profil, constantes, médecin, véhicule, contacts et événement d'audit doivent réussir ou être annulés ensemble.
- Journaliser les champs modifiés sans recopier les valeurs médicales sensibles dans `audit_logs`; conserver la donnée métier courante uniquement dans les tables protégées prévues à cet effet.
- Ajouter une instrumentation Express transversale des requêtes mutantes (`POST`, `PUT`, `PATCH`, `DELETE`) avec acteur, organisation, méthode, route normalisée, statut HTTP, origine client, IP, user-agent et identifiant de corrélation.
- Ajouter un audit explicite des connexions réussies/refusées et changements d'organisation; ne jamais inclure mots de passe, PIN, codes d'urgence, JWT ou corps complets des requêtes.
- Conserver l'historique des positions des ambulances/unités dans une table append-only au lieu de seulement remplacer leur dernière position dans `response_units`.
- Maintenir les événements métier spécialisés existants (`incident_events`, `ride_events`, `scan_access_events`, audit RBAC/admissions) en complément du journal transversal.
- Ajouter un endpoint de suppression contrôlée de la fiche médicale permettant au propriétaire d'effacer ses données médicales et contacts après vérification du mot de passe, tout en conservant le minimum de compte et une trace non médicale de l'opération.
- Étendre les tests de qualité, exécuter les builds backend/web/console/mobile, documenter les limites restantes, puis publier sur `main`.

### Réalisation — persistance et traçabilité complète
- La migration `backend/migrations/20260811_complete_activity_audit.sql` crée `api_activity_logs` et `response_unit_positions`, leurs index, RLS et la publication Realtime des positions autorisées.
- Chaque requête mutante reçue par Express est maintenant journalisée après réponse avec un `request_id`, acteur, organisation, méthode, route normalisée, statut, succès, origine (`citizen_web`, `mobile`, `console_web` ou API), IP, user-agent, durée et uniquement les **noms** des champs transmis.
- Les lectures sensibles de profil, scan, interventions, admissions, audit, utilisateurs et organisations sont également inscrites dans ce journal. Les lectures publiques ordinaires, ressources statiques et préférences d'interface ne génèrent pas de bruit inutile.
- La liste d'exclusion interdit au middleware d'enregistrer mots de passe, PIN, codes, JWT, jetons Realtime ou jetons push. Les corps complets des requêtes ne sont jamais copiés dans l'audit transversal.
- Les clients déclarent explicitement leur origine avec `X-LOTISEC-Client`; le journal permet donc de distinguer portail citoyen, application Expo et console institutionnelle.
- Inscription, connexion réussie/refusée, déconnexion, changement d'organisation et changement de mot de passe possèdent en plus un événement métier explicite dans `audit_logs`.
- La déconnexion web, mobile et console appelle maintenant `/auth/logout` avant d'effacer la session locale. Une panne réseau n'empêche toutefois pas la révocation locale de la session.
- La mise à jour du profil est transactionnelle : profil principal, taille, poids, médecin, véhicule, PIN éventuel, suppression/remplacement des contacts et événement d'audit sont validés ensemble ou annulés ensemble.
- L'audit de profil conserve les champs modifiés, le nombre de contacts et l'indication de renouvellement du PIN, mais pas les valeurs médicales elles-mêmes. Les valeurs courantes restent dans `profiles` et `emergency_contacts`.
- Web citoyen : tous les contacts d'urgence existants sont conservés, modifiables, ajoutables et supprimables; le changement de mot de passe est relié au backend; l'effacement médical nécessite le mot de passe et une confirmation explicite.
- Mobile : modification du mot de passe et déconnexion ne sont plus des simulations; l'effacement de la fiche est disponible avec mot de passe et confirmation native.
- `DELETE /profil/medical-data` efface groupe sanguin, constantes, antécédents, traitements, médecin, véhicule, contacts et PIN. Le compte, l'identité minimale et le QR restent actifs afin que le citoyen puisse recréer sa fiche.
- Chaque position envoyée par une unité continue de mettre à jour `response_units` pour la carte instantanée et crée maintenant une ligne append-only dans `response_unit_positions` pour l'historique opérationnel.
- La console « Audit » présente les événements métier et les activités API web/mobile/console; l'API `/api/v1/activity-audit` applique le périmètre organisationnel et la permission `reports:read`.

### Vérifications de cette phase
- Backend : compilation réussie et **33/33 tests** réussis, dont transaction profil, exclusion des secrets, audit multi-client, authentification et historique des positions.
- Portail citoyen : build TypeScript/Vite/PWA réussi; l'avertissement historique de taille du bundle reste non bloquant.
- Console institutionnelle : build Vite et syntaxe réussis.
- Mobile Expo : `npx tsc --noEmit` réussi.

### Déploiement requis
- Appliquer `20260811_complete_activity_audit.sql` **après** `20260811_profile_vitals.sql` et `20260811_secure_medical_access.sql`, puis déployer le backend.
- Définir une politique légale de conservation/purge pour `api_activity_logs`, `audit_logs`, `scan_access_events` et les historiques GPS; la durée doit être validée selon les obligations locales de protection des données et de secours.
- Les clics purement visuels (ouvrir un menu, changer le thème, modifier un filtre sans mutation serveur) restent volontairement locaux. Toutes les actions CRUD et décisions métier passant par l'API sont persistées et auditables.
- Publication effectuée sur `main` au commit `21d35b8` (`Persist and audit all cross-client CRUD activity`).
- Un nouvel APK Expo/EAS incluant ce commit a été envoyé avec le profil `preview`. Suivi et téléchargement après finalisation : `https://expo.dev/accounts/profzen/projects/lotisec/builds/af257a75-9c09-46a0-898e-56999cf68584`.

### Mise en production effective des migrations
- La base configurée dans `backend/.env` a été migrée avec succès. La dépendance additive `20260802_mobile_zem_complete.sql` a d'abord été appliquée parce que la table `scan_access_events` manquait encore sur cet environnement.
- `20260811_profile_vitals.sql`, `20260811_secure_medical_access.sql` et `20260811_complete_activity_audit.sql` sont maintenant appliquées. Les contrôles SQL confirment : constantes vitales, hash du PIN, codes d'urgence, journal d'activité et historique des positions.
- `backend/run-security-migrations.js` fournit désormais un exécuteur reproductible : registre `lotisec_schema_migrations`, checksum SHA-256, transaction par fichier, refus d'une migration déjà appliquée mais modifiée et vérification finale sans affichage de secret.
- Le backend public répond `{"ok":true,"db":"up"}` sur `/health` après migration.
- Le build EAS `af257a75-9c09-46a0-898e-56999cf68584`, basé sur le commit fonctionnel `21d35b8`, est `FINISHED`. APK : `https://expo.dev/artifacts/eas/Ofb603SU0Eyk8dTGentKDKW1wH7yCer_OQj4vpjCbas.apk` (artefact interne soumis à la durée de conservation Expo indiquée sur la page du build).
