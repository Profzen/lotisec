# memoire.md — SafeLife / LOTISEC

But: Ce fichier est le point de vérité pour reprendre le projet. Il doit être enrichi à chaque étape importante.

Statut de référence: ce document reflète les décisions validées au 2026-06-02.

## 1. Résumé projet
- Nom produit: SafeLife / LOTISEC (Localisation, Transmission, Identification, Sécurité, Cartographie).
- But: Plateforme d'urgence routière (Togo) couvrant identification via QR, SOS, cartographie, USSD, et dashboard pro.
- Dossiers présents dans le workspace (issus de repos clonés existants):
  - `Qr-mobile` : application mobile Expo (React Native).
  - `QR-PYTHON` : backend FastAPI (Python) + traces Node.
  - `safelife-pro` : dashboard web (React + TypeScript + Leaflet).

## 1.1 Décisions d'architecture validées (IMPORTANT)
- La cible backend devient **Node.js** (abandon progressif du backend Python en production).
- Un nouveau dossier backend de référence sera créé: `backend/`.
- `QR-PYTHON` est conservé temporairement en local pour comparaison/migration, mais ne doit plus être poussé.
- Priorité immédiate: construire d'abord la **version web de la partie app mobile** déjà existante.
- Déploiement cible: backend Node.js + frontend web sur Vercel (free tier), puis consommation API par l'app mobile Expo.

## 2. Où commencer (points d'entrée)
- Mobile: `Qr-mobile/App.tsx` → navigation: `Qr-mobile/src/navigation/AppNavigator.tsx`.
- Backend: `QR-PYTHON/app/main.py` (FastAPI) ; `QR-PYTHON/Procfile` pour déploiement.
- Web pro: `safelife-pro/src/App.tsx` → services: `safelife-pro/src/services/*`.
- CDC (spec produit): `cdc.txt` à la racine du workspace.
- Briefing technique complémentaire: `lt.txt` à la racine du workspace.

## 3. Stack technique (consolidé)
- Mobile: Expo + React Native (Expo SDK), React Navigation, expo-location, expo-print, QR svg.
- Backend: FastAPI, Uvicorn, SQLAlchemy, PostgreSQL (Supabase), Alembic, GeoAlchemy2.
- Web: React + TypeScript, React-Leaflet, Leaflet.heat.
- Temps réel: WebSocket (implémenté côté web et backend).
- USSD / Paiement: Afrique's Talking, T-Money / Flooz (prévu dans CDC mais non implémenté complètement).

## 3.1 Stack cible (migration)
- Backend cible: Node.js + TypeScript + Express + ws + PostgreSQL.
- Front web cible pour la partie app mobile: React/TypeScript (aligné avec composants mobile et logique métier existante).
- Mobile cible: Expo, branché sur API publiées par le backend Node.js.

## 4. Environnement & variables clés
- Backend URL par défaut attendu par le mobile: `https://safelife.up.railway.app` (dans `Qr-mobile/src/api/config.ts`).
- Backend dotenv: `QR-PYTHON/.env` (contient clés DB et secrets).
- Web: `.env.production` présent dans `safelife-pro`.

## 4.1 Repositories & Git (décisions)
- Dépôt distant officiel pour le nouveau socle: `https://github.com/Profzen/lotisec`.
- Les dossiers actuels étant des repos clonés, la stratégie sera de créer un **repo propre unifié** piloté par ce remote.
- `QR-PYTHON/` doit être ajouté au `.gitignore` du nouveau repo afin d'éviter son push.

## 5. Comment lancer localement (rapide)
- Mobile (dans `Qr-mobile`):
  - Installer dépendances:

```bash
cd Qr-mobile
npm install
```

  - Démarrer Expo:

```bash
npx expo start
# puis ouvrir dans Expo Go (scan QR) ou appuyer 'a' pour Android emulator
```

- Backend (FastAPI):
  - Créer virtualenv, installer `requirements.txt` puis lancer:

```bash
cd QR-PYTHON
python -m venv .venv
# activer .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

  - Vérifier la route racine: `GET /` → renvoie status project.

- Web (dashboard):

```bash
cd safelife-pro
npm install
npm start
# ouvre http://localhost:3000
```

Notes: si le backend distant `https://safelife.up.railway.app` est accessible, le mobile et le web peuvent utiliser ce serveur sans lancer localement le backend.

## 6. Flux critiques à tester en priorité
- Mobile: onboarding (register 5 étapes), génération du QR, affichage QR, bouton SOS (vérifier ouverture WhatsApp et GPS), écran Hôpitaux.
- Backend: routes `/auth/*`, `/profil/*`, `/scan/*`, endpoints alertes (WebSocket).
- Web: connexion pro, réception d'alertes via WebSocket, affichage carte et fiches victimes.

## 7. Conventions et règles de conduite (à respecter)
- Branches: `main` = stable. Créer feature branches `feat/<quoi>` ou `fix/<quoi>`.
- Commits: messages courts en anglais/français; préfixe `feat:`, `fix:`, `chore:`.
- Tests: ajouter tests unitaires quand on touche logique métier importante.
- Secrets: ne pas committer `.env` avec secrets; utiliser `.env.sample` et documenter.
- Déploiement: cible en cours = Vercel pour frontend web + backend Node.js; mobile via EAS / Play Store pour builds.

## 8. API contract (quick reference)
- Mobile expects:
  - `POST /auth/login` -> { phone, password } => token
  - `POST /auth/register` and profile endpoints under `/profil`
  - `GET /scan/:token` (public scan page hosted on web)
  - WebSocket path: defined in `safelife-pro/src/services/websocket.ts` and backend routers `app/routers/alertes.py`.

(ATTENTION: vérifier routes exactes dans `QR-PYTHON/app/routers` avant de développer.)

## 9. Écarts connus vs CDC
- Manquants ou partiellement implémentés: USSD, sentinelles zémidjan, micro-assurance, guidage vocal offline, dispatch avancé, exports gouvernementaux.
- Incohérences: `safelife-pro` contient un sous-dossier dupliqué `safelife-pro/` à nettoyer; backend contient un `index.js` Node en plus du FastAPI.

## 9.1 Incohérences techniques constatées (audit code)
- `safelife-pro/src/services/api.ts` appelle certains endpoints avec des méthodes/contrats potentiellement divergents du backend Python (`POST` vs `PUT`, format de réponse alertes).
- `QR-PYTHON/app/main.py` contient des indices de dette technique (référence `models` non explicite dans le fichier).
- Nécessité de figer un contrat API unique pendant la migration pour éviter les régressions mobile/web.

## 9.2 Objectif fonctionnel non négociable
- Le backend Node.js doit reproduire le comportement fonctionnel actuel "comme ça l'était" avant d'ajouter des nouveautés.

## 10. Procédure d'enrichissement du fichier
- Chaque action importante (nouvelle API, migration DB, changement de contrat, décision d'architecture) doit être ajoutée en bas du fichier sous "Changelog" avec date et auteur.
- Exemple d'entrée:
  - `2026-05-29 — Import initial du projet et notes d'analyse — copilot`.

## 11. Changelog initial
- 2026-05-29 — Mémo initial créé et enregistré au workspace root.

## 11.1 Changelog récent
- 2026-06-01 — Revue globale des dossiers `Qr-mobile`, `QR-PYTHON`, `safelife-pro`, `cdc.txt`, `lt.txt`.
- 2026-06-01 — Décision validée: migration backend Python -> backend Node.js dans `backend/`.
- 2026-06-01 — Décision validée: conserver `QR-PYTHON/` localement mais l'exclure du push via `.gitignore`.
- 2026-06-01 — Priorité validée: développer d'abord la version web de la partie app mobile.
- 2026-06-02 — Remote de travail confirmé: `https://github.com/Profzen/lotisec` (repo vierge à initialiser localement).
- 2026-06-02 — Backend Node.js initial créé dans `backend/` (Express + TypeScript + ws + PostgreSQL + JWT + routes principales).
- 2026-06-02 — Frontend web citoyen initial créé dans `frontend/` (Vite + React + TypeScript), aligné sur les flux mobile: auth, SOS, QR, hôpitaux.
- 2026-06-02 — `.gitignore` racine ajouté avec exclusion explicite de `QR-PYTHON/` et `safelife-pro/`.
- 2026-06-02 — Nouveau dépôt Git racine initialisé, remote configuré vers `https://github.com/Profzen/lotisec`.
- 2026-06-02 — Push effectué sur `origin/main` avec socle harmonisé: `Qr-mobile/` + `backend/` + `frontend/` + docs racine.
- 2026-06-02 — Mobile: bascule config API vers variable Expo `EXPO_PUBLIC_API_URL` (`Qr-mobile/src/api/config.ts`) avec fallback temporaire Railway.
- 2026-06-02 — Mobile: profils EAS `development/preview/production` enrichis avec `EXPO_PUBLIC_API_URL` et ajout de `Qr-mobile/.env.example`.

## 12. Prochaines actions recommandées
- Initialiser la nouvelle structure repo unifiée orientée cible (`backend/`, app web, mobile Expo).
- Ajouter `QR-PYTHON/` au `.gitignore` du nouveau repo.
- Définir et documenter le contrat API canonique (auth, profil, scan, alertes, accidents, websocket).
- Implémenter le socle backend Node.js minimal compatible avec les appels existants.
- Porter la partie app mobile vers une version web (écrans et flux prioritaires), puis connecter sur le backend Node.js.
- Préparer le déploiement Vercel (frontend + backend) avec variables d'environnement.

## 13. Règle de maintien du contexte
- À chaque décision produit/architecture/devops, ajouter une entrée datée dans la section Changelog.
- À chaque changement de contrat API, mettre à jour les sections 8 (contrat) et 12 (actions).
- Ce fichier est la source primaire de reprise inter-conversation: le garder synchronisé avec le code.

---

Note d'usage: ce document doit rester strictement factuel et orienté exécution.