# Déploiement du cycle mobile/Zem

## Ordre obligatoire

1. Dans Supabase, créer un snapshot/backup de production et noter son horodatage.
2. Depuis `backend`, vérifier le schéma sans écriture :

   ```powershell
   npm run audit:mobile-zem
   ```

3. Appliquer la migration additive :

   ```powershell
   npm run migrate:mobile-zem
   ```

4. Relancer l’audit et vérifier la présence de `ride_offers`, `ride_events`, `ride_messages`, `ride_positions`, `device_push_tokens` et `scan_access_events`.
5. Importer/actualiser les établissements OpenStreetMap du Togo :

   ```powershell
   npm run import:facilities
   ```

   L’import déduplique par nom normalisé, téléphone ou proximité à 100 m, conserve les corrections manuelles et désactive les objets OSM disparus au lieu de les supprimer.

6. Vérifier que Vercel a redéployé `backend` et `frontend` depuis `main`. Aucun changement de variable Vercel n’est requis si les valeurs actuelles `DATABASE_URL`, `SUPABASE_JWT_SECRET`, `CORS_ORIGINS`, `VITE_API_URL`, `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` sont toujours présentes.
7. Exécuter la recette avec deux comptes dédiés, sans versionner leurs secrets :

   ```powershell
   $env:E2E_CITIZEN_PHONE="<téléphone>"
   $env:E2E_CITIZEN_PASSWORD="<mot-de-passe>"
   $env:E2E_ZEM_PHONE="<téléphone>"
   $env:E2E_ZEM_PASSWORD="<mot-de-passe>"
   npm run e2e:zem
   ```

8. Vérifier localement :

   ```powershell
   cd ..\Qr-mobile
   npx tsc --noEmit
   npx expo export --platform web
   cd ..\frontend
   npm run build
   cd ..\backend
   npm test
   ```

## Notifications

Les notifications distantes Expo nécessitent un appareil réel et un build EAS ; Expo Go Android ne constitue pas une recette push suffisante. Le projet EAS est déjà déclaré dans `Qr-mobile/app.json`. Tester une offre, une acceptation, un changement d’étape et un message avec l’application en arrière-plan, puis toucher la notification pour vérifier l’ouverture du détail ou du chat.

## APK preview

Uniquement après réussite de la recette Web et production :

```powershell
cd G:\zen\projets\lotisec\Qr-mobile
npx eas-cli build --platform android --profile preview
```

Le profil `preview` produit un APK interne. Ne jamais ajouter un secret backend à une variable `EXPO_PUBLIC_*`.

## Retour arrière

- Applicatif : redéployer le commit stable précédent sur Vercel.
- Données : restaurer le snapshot Supabase si la migration elle-même échoue. La migration est additive et ne modifie aucune ancienne course.
- Import médical : les lignes OSM sont identifiées par `(source, source_id)` et peuvent être désactivées (`active=false`) sans toucher aux entrées manuelles.
- Ne pas supprimer les événements, messages ou scans d’audit pour « nettoyer » une recette ; utiliser des comptes et courses de recette identifiés.
