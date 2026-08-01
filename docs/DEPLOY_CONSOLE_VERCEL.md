# Déployer la console LOTISEC sur Vercel

## Base et premier administrateur

1. Sauvegarder la base Supabase.
2. Exécuter `backend/migrations/20260731_operational_platform.sql` dans Supabase SQL Editor.
3. Définir localement `DATABASE_URL`, `INITIAL_ADMIN_PHONE` et `INITIAL_ADMIN_PASSWORD` (12 caractères minimum).
4. Depuis `backend/`, exécuter `npm run create-admin`.
5. Supprimer ensuite les variables `INITIAL_ADMIN_*`. Ne jamais les versionner.

## Troisième projet Vercel

1. Vercel > Add New > Project, puis importer `Profzen/lotisec`.
2. Nom conseillé : `lotisec-console`.
3. Root Directory : `LOTISEC-Console-Complete`.
4. Framework : Vite.
5. Install Command : `npm install`.
6. Build Command : `npm run build`.
7. Output Directory : `dist`.
8. Ajouter `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` et `VITE_CITIZEN_URL` pour Production, Preview et Development.
9. Déployer puis ouvrir `/console` ou `/console.html`.

Dans le projet backend, définir puis redéployer :

```text
CORS_ORIGINS=https://lotisec-frontend.vercel.app,https://lotisec-console.vercel.app
```

Ajouter également `SUPABASE_JWT_SECRET` côté backend uniquement. Il permet d'émettre le jeton Realtime court utilisé par les politiques RLS. Ne jamais l'exposer dans une variable `VITE_*`.

Vérifier aussi côté backend : `DATABASE_URL`, un `JWT_SECRET` aléatoire d’au moins 32 caractères, `NODE_ENV=production`, `ENABLE_LEGACY_PRO_LOGIN=false` et `ENABLE_LEGACY_SCAN_CODES=false`. Redéployer le backend après toute modification de CORS ou de secret.

Ajouter explicitement tout domaine personnalisé ou Preview autorisé.

## Recette production

1. Vérifier `/health` (`ok=true`).
2. Connecter le premier admin à la console.
3. Vérifier qu'un citoyen est refusé.
4. Déclencher un SOS web puis mobile et vérifier leur apparition.
5. Valider, affecter une ressource et faire progresser l'intervention.
6. Envoyer une admission et répondre avec le compte de l'hôpital ciblé.
7. Mettre à jour une capacité hospitalière.
8. Soumettre et approuver une demande Zem.
9. Vérifier l'isolation des ressources et admissions entre deux organisations.
10. Vérifier dans l’en-tête de la console la mention `SUPABASE REALTIME ACTIF`; si elle affiche `POLLING API AUTHENTIFIÉ`, contrôler `SUPABASE_JWT_SECRET`, l’URL et la clé anon.
11. Ouvrir le journal d’audit admin et vérifier les créations, changements de statut, affectations, capacités et admissions.
12. Depuis `backend/`, exécuter `npm run verify:schema`, `npm run smoke:operations` et `npm run verify:workflow`.

Après création du premier administrateur, retirer `INITIAL_ADMIN_PHONE` et `INITIAL_ADMIN_PASSWORD` de `backend/.env` et des éventuelles variables Vercel. Elles ne sont pas nécessaires au fonctionnement normal.

Pour revenir en arrière sans perte, réaffecter le domaine au déploiement console précédent et redéployer le backend précédent. Laisser les tables additives en place; ne pas exécuter de suppression de tables ou de colonnes.

Les visualisations de trafic/Fog restent démonstratives tant qu'un fournisseur réel n'est pas raccordé.
