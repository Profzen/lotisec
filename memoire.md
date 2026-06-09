# memoire.md — SafeLife / LOTISEC

Document de reprise opérationnelle. Ce fichier centralise l'état réel du projet, les décisions actées, les tests effectués, les incidents observés, les blocages et le plan d'exécution.

Statut de référence: 2026-06-07.

## 1. Contexte produit et périmètre
- Produit: LOTISEC / SafeLife (Localisation, Transmission, Identification, Sécurité, Cartographie).
- Mission: gestion d'urgence routière (QR médical, SOS, cartographie, alertes pro, extension USSD).
- Cible de migration validée: remplacement du backend Python historique par un backend Node.js.

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

## 3. Architecture cible validée
- Backend Node.js/TypeScript/Express/PostgreSQL.
- Frontend web citoyen (React + Vite) déployable séparément.
- Mobile Expo consommant les APIs backend Node via variable d'environnement.
- Déploiement visé en 2 projets Vercel séparés:
  - projet frontend (root `frontend/`)
  - projet backend (root `backend/`)

## 4. État d'avancement par composant

### 4.1 Backend Node (`backend/`)
Réalisé:
- Socle API en place (Express + TypeScript).
- Routeurs implémentés:
  - `/auth` (register/login)
  - `/pro` (login pro)
  - `/profil` (create/update + scan)
  - `/scan` et `/scans` (verify, create, historique)
  - `/alertes` (create/list/update)
  - `/accidents` (create, geojson, heatmap, hotspots, stats, update)
  - `/geo` (heatmap, hotspots, hopital-proche, stats, accidents-zone, rapport)
  - `/road-reports`
  - `/responders`
- Compatibilité Vercel serverless ajoutée:
  - `backend/api/index.ts`
  - `backend/vercel.json`
  - factorisation app dans `backend/src/app.ts`.
- Robustesse runtime:
  - support `express-async-errors`
  - middleware d'erreur JSON global
  - timeout de connexion PostgreSQL (`connectionTimeoutMillis=5000`).

En attente / incomplet:
- Contrat API à figer finement contre les flux mobile historiques (parité complète non encore prouvée).
- WebSocket temps réel en mode Vercel serverless: contraintes inhérentes (non garanti en serverless pur).
- USSD, micro-assurance, sentinelles, exports gouvernementaux: non implémentés.

### 4.2 Frontend web citoyen (`frontend/`)
Réalisé:
- MVP fonctionnel créé (auth, inscription, home, SOS, recommandations hôpitaux, conseils).
- Fallback API défini vers `https://lotisec-backend.vercel.app`.
- Build local validé.

En attente / incomplet:
- UI/UX: version MVP utilitaire, pas encore finalisation design/ergonomie.
- Validation fonctionnelle bout-en-bout dépendante de la connectivité DB backend.

### 4.3 Mobile Expo (`Qr-mobile/`)
Réalisé:
- Bascule API vers variable Expo publique:
  - `Qr-mobile/src/api/config.ts` lit `EXPO_PUBLIC_API_URL`.
- Profils EAS mis à jour:
  - `preview` et `production` pointent vers `https://lotisec-backend.vercel.app`.
- `Qr-mobile/.env.example` ajouté.

État technique connu:
- `npx tsc --noEmit` dans `Qr-mobile/` remonte des erreurs préexistantes non liées à la bascule API:
  - typings navigation (`Home`, `Splash`)
  - `colors.primaryLight` absent
  - clé dupliquée `header` dans `HomeScreen`.

## 5. Déploiement Vercel: état réel

### 5.1 Frontend Vercel
- URL: https://lotisec-frontend.vercel.app
- Statut: page chargée.

### 5.2 Backend Vercel
- URL: https://lotisec-backend.vercel.app
- Route racine observée: `{"status":"online","project":"SafeLife Node API","db_configured":true}`.
- Route health observée: `{"ok":false,"db":"down","detail":"connect ECONNREFUSED 127.0.0.1:5432"}`.

Diagnostic confirmé:
- Le backend est déployé et répond HTTP.
- La connexion PostgreSQL en production échoue (la variable `DATABASE_URL` cible une base locale/non joignable depuis Vercel, typiquement localhost/127.0.0.1).
- Conséquence directe: inscription/login échouent côté frontend (`Echec d inscription`, requêtes API échouées/timeout).

## 6. Tests réalisés et résultats

Tests backend:
- `GET /` (prod Vercel): PASS (service en ligne).
- `GET /health` (prod Vercel): FAIL (DB down, ECONNREFUSED 127.0.0.1:5432).
- `POST /auth/register` (prod): FAIL / timeout (symptôme cohérent avec problème DB).

Tests frontend:
- Chargement page d'accueil: PASS.
- Parcours inscription: FAIL (message "Echec d inscription").

Tests build locaux:
- `backend`: PASS (`npm run build`).
- `frontend`: PASS (`npm run build`).
- `Qr-mobile`: FAIL partiel (erreurs TypeScript préexistantes non bloquantes pour la migration backend).

## 7. Blocage principal actuel
- Aucun blocage P0 actif. Le backend Vercel est connecté à la base de données Supabase.
- (Précédent blocage levé: DATABASE_URL backend Vercel joignable en production).

## 8. Variables d'environnement attendues (production)

### 8.1 Backend Vercel (`backend`)
- `DATABASE_URL` = URL PostgreSQL distante valide (pas localhost/127.0.0.1).
- `JWT_SECRET` = secret fort.
- `NODE_ENV` = `production`.
- `CORS_ORIGIN` = `https://lotisec-frontend.vercel.app` (ou `*` temporaire).

### 8.2 Frontend Vercel (`frontend`)
- `VITE_API_URL` = `https://lotisec-backend.vercel.app`.

### 8.3 Mobile Expo (`Qr-mobile`)
- `EXPO_PUBLIC_API_URL` = `https://lotisec-backend.vercel.app`.

## 9. Plan de reprise immédiat (ordre recommandé)
1. Corriger `DATABASE_URL` dans le projet backend Vercel.
2. Redéployer backend.
3. Vérifier `GET /health` attendu: `ok=true` et `db=up`.
4. Retester `POST /auth/register`.
5. Retester inscription depuis frontend.
6. Si PASS, confirmer les flux login/profil/sos.
7. Ensuite seulement: passe UI/UX frontend et parité API complète avec mobile.

## 10. Plan court terme (après déblocage DB)
1. Figer le contrat API canonique (payloads + statuts + erreurs) dans un document dédié.
2. Exécuter une matrice de tests bout-en-bout:
   - auth register/login
   - profil create/update
   - scan verify
   - alertes create/list/update
   - accidents stats/geojson
3. Corriger les erreurs TypeScript préexistantes de `Qr-mobile`.
4. Ajuster frontend responsive et design final.

## 11. Risques techniques connus
- Vercel serverless et WebSocket persistent: risque de limitations temps réel.
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

## 13. Références de reprise rapide
- Spécification produit: `cdc.txt`.
- Brief technique détaillé: `lt.txt`.
- Configuration backend Vercel: `backend/vercel.json` et `backend/api/index.ts`.
- Point d'entrée API: `backend/src/app.ts`.
- Client API frontend: `frontend/src/api/client.ts`.
- Config API mobile: `Qr-mobile/src/api/config.ts` et `Qr-mobile/eas.json`.

---

Règle de maintenance du fichier:
- Toute décision architecture/devops/test doit être tracée immédiatement.
- Toute régression ou blocage prod doit être documenté avec symptôme + cause + action corrective.

Règle UI/UX (Frontend & Mobile):
- Les erreurs API et de validation doivent être affichées de manière visuelle et inline dans l'interface (ex: textes d'erreur rouges sous les champs). L'utilisation de pop-ups systèmes (`Alert.alert`) est proscrite pour les flux principaux afin d'assurer une compatibilité Web parfaite et une expérience utilisateur premium.