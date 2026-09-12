# README — Exécution de la mise à niveau LOTISEC

Ce fichier est le point d’entrée pour l’agent IA de développement.

## Source de vérité

Lire intégralement `memoire.md` fourni avec ce README avant toute modification.

## Mission

Aligner complètement :

```text
Qr-mobile/
frontend/
backend/
LOTISEC-Console-Complete/
```

sur un même contrat métier et un même flux réel.

## Priorités

1. Corriger SOS et contrat incident.
2. Supprimer tous les faux fallbacks opérationnels.
3. Ajouter enrichissement d’un incident.
4. Ajouter reprise offline et dédoublonnage.
5. Persister validation et affectation console en mode réel.
6. Corriger carte APK.
7. Aligner Zem APK / Web / backend.
8. Exécuter les tests E2E.
9. Mettre à jour la documentation.

## Règles

- Ne pas modifier le design console sans nécessité.
- Ne pas casser le mode test 8 étapes.
- Ne pas présenter une donnée simulée comme réelle.
- Ne pas déclarer une fonctionnalité terminée sans test.
- Backend = source d’autorité.
- Mode `test` et mode `real` restent strictement séparés.
- SOS doit rester simple et rapide.

## Fichiers à auditer en priorité

```text
Qr-mobile/src/screens/HomeScreen.tsx
Qr-mobile/src/components/PlatformMap.native.tsx
Qr-mobile/src/components/PlatformMap.web.tsx
Qr-mobile/src/screens/ZemPassengerScreen.tsx
Qr-mobile/src/screens/ZemDriverScreen.tsx
Qr-mobile/src/screens/RideDetailScreen.tsx
Qr-mobile/src/api/config.ts

frontend/src/pages/Home.tsx
frontend/src/pages/MapZem.tsx
frontend/src/pages/MapZemDriver.tsx
frontend/src/pages/RideDetail.tsx
frontend/src/api/client.ts

backend/src/routers/operations.ts
backend/src/routers/zem.ts
backend/src/security/workflows.ts

LOTISEC-Console-Complete/src/App.jsx
LOTISEC-Console-Complete/src/pages/Alerts.jsx
LOTISEC-Console-Complete/src/services/api.js
LOTISEC-Console-Complete/src/services/mobileGateway.js
LOTISEC-Console-Complete/MOBILE_INTEGRATION.md
LOTISEC-Console-Complete/docs/mobile-incident.schema.json
```

## Définition de succès

Une seule démonstration doit suffire :

```text
APK/Web mobile
→ SOS réel
→ backend
→ console
→ complément
→ validation
→ affectation persistée
→ statut renvoyé
```

et :

```text
Zem passager
→ carte fonctionnelle
→ demande
→ offre conducteur
→ acceptation
→ suivi GPS
→ trajet
→ clôture
```

Voir `memoire.md` pour les exigences détaillées, tests et critères de fin.
