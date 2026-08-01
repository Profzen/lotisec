# LOTISEC — Console géodécisionnelle

Cette archive contient le code source complet de la console web LOTISEC :

- réception des signalements mobiles et création manuelle d’incidents ;
- carte interactive géoréférencée ;
- suivi animé et orienté des ambulances ;
- analyse du trafic avant le départ ;
- affichage de l’axe congestionné en rouge et de la déviation fluide en vert ;
- recommandation de l’hôpital le plus proche ;
- gestion des ambulances, hôpitaux, interventions et capacités ;
- Fog Computing, statistiques et rapports téléchargeables ;
- modes clair et sombre.

## Prérequis

- Node.js 20 ou version ultérieure ;
- npm 10 ou version ultérieure.

## Lancement local

```bash
npm install
npm run dev
```

Ouvrir ensuite l’adresse affichée dans le terminal. La route principale redirige automatiquement vers `public/console.html`.

## Compilation

### Build Vinext / Cloudflare

```bash
npm run build
```

### Build Next.js pour Vercel

```bash
npm run build:next
```

Pour Vercel, importer le dossier dans un dépôt Git, choisir le framework **Next.js** et utiliser `npm run build:next` comme commande de build.

## Structure principale

- `app/page.jsx` : entrée directe vers la console ;
- `app/api/v1/incidents/mobile/route.js` : ancien prototype D1 conservé comme référence, non utilisé par le déploiement Vercel ;
- `public/console.html` : structure de l’interface opérationnelle ;
- `public/console.css` : design, thèmes, cartes et responsive ;
- `public/console.js` : incidents, carte, itinéraires, ambulances, Fog et interactions ;
- `public/assets/logo-lotisec.png` : logo officiel fourni ;
- `drizzle/0000_mobile_incidents.sql` : schéma de stockage des signalements ;
- `vite.config.ts`, `next.config.mjs` et `wrangler.jsonc` : configuration de compilation et d’hébergement.

## Données cartographiques

La carte repose sur Leaflet et OpenStreetMap. Le calcul routier utilise un service d’itinéraire compatible OSRM, avec un tracé géoréférencé de secours si ce service est temporairement indisponible.

## Démonstration de congestion

1. Ouvrir **Carte en direct** ou **Trafic en temps réel**.
2. Cliquer sur **Simuler la congestion avant départ**.
3. L’ambulance revient au point de départ.
4. L’axe congestionné apparaît en rouge.
5. Le Fog calcule une déviation fluide en vert.
6. Après le contrôle pré-départ, l’ambulance commence son déplacement sur la déviation.
# Intégration monorepo

Cette application est la troisième interface officielle de LOTISEC. Elle utilise le backend Node et Supabase comme source de vérité. L'ancien stockage Cloudflare D1 n'est plus utilisé par la console déployée.

La console exige un JWT de `/auth/login`, filtre son menu selon les rôles et n'affiche les données de démonstration qu'avec `?demo=1`. `VITE_API_URL` est injectée dans `public/config.js` pendant le build.
