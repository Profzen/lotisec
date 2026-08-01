# Plateforme opérationnelle LOTISEC

## Source de vérité

Le backend `backend/` et PostgreSQL/Supabase sont l'unique source métier. Le web citoyen, le mobile et la console n'ont pas de base métier indépendante. Cloudflare D1 et l'ancien endpoint de démonstration de la console ne font plus partie de l'architecture cible.

## Applications

- `frontend/` : portail citoyen et demande de Zem.
- `Qr-mobile/` : application citoyenne et terrain Zem.
- `LOTISEC-Console-Complete/` : console institutionnelle responsive.
- `backend/` : authentification, autorisations et mutations métier.

## RBAC

| Rôle | Portée principale |
|---|---|
| `admin` | Toute la plateforme, organisations, utilisateurs et audit |
| `supervisor` | Supervision opérationnelle globale et validation Zem |
| `dispatcher` | Incidents, ressources, affectations et interventions |
| `firefighter` | Missions de son organisation et statuts terrain |
| `ambulance_driver` | Missions affectées et positions terrain |
| `hospital_manager` | Capacités, admissions et membres de son hôpital |
| `hospital_agent` | Admissions de son hôpital |
| `zem_driver` | Activité Zem après accréditation |
| `citizen` | Profil, SOS et courses passager |

Un utilisateur peut cumuler plusieurs rôles. Les rôles institutionnels portent une `organization_id`. Les routes filtrent les interventions, ressources, capacités et admissions par cette organisation.

### Matrice de permissions

| Rôle | Permissions principales | Portée console |
|---|---|---|
| admin | `*`, `admin:manage` | Globale, comptes, rôles, organisations, audit |
| supervisor | incidents/interventions/ressources/rapports, validation Zem | Supervision opérationnelle globale |
| dispatcher | incidents, affectations, ressources, interventions | Centrale opérationnelle |
| firefighter | `interventions:assigned`, `interventions:update`, établissements en lecture | Missions de son organisation ou qui lui sont affectées |
| ambulance_driver | mêmes droits terrain que firefighter | Missions et position du véhicule de son organisation |
| hospital_manager | admissions, capacités, membres | Uniquement son hôpital ou sa clinique |
| hospital_agent | admissions et établissements en lecture | Admissions de son établissement |
| zem_driver | `zem:drive` | Mobile Zem uniquement, après approbation |
| citizen | profil, création d’incident, course passager | Aucun accès console |

Les menus masqués ne constituent pas la sécurité : chaque mutation est de nouveau contrôlée dans le backend. Un gestionnaire hospitalier ne peut ni modifier un autre établissement ni créer un autre gestionnaire; seul l’admin le peut.

## Schéma de données

- `organizations` et `organization_members` portent les établissements et appartenances.
- `roles` et `user_roles` permettent le cumul de rôles globaux ou rattachés à une organisation.
- `zem_driver_applications` conserve l’accréditation `pending`, `approved` ou `rejected`.
- `incidents` et `incident_events` sont la source canonique des SOS et de leur timeline.
- `response_units` contient ambulances, engins et équipes avec leur position.
- `interventions` relie incident, organisation, unité, agent affecté et hôpital cible.
- `facility_capacities` décrit les places par service hospitalier.
- `hospital_admission_requests` porte la demande et la réponse hospitalière.
- `operational_notifications` et `notification_receipts` fournissent notifications ciblées et lecture par utilisateur.
- `audit_logs` enregistre les mutations sensibles.

## Données et API

La migration additive `backend/migrations/20260731_operational_platform.sql` crée les organisations, rôles, demandes Zem, incidents, unités, interventions, capacités, admissions et audit sans supprimer les tables historiques.

- `POST/GET /api/v1/incidents` : SOS canonique et file de supervision.
- `PATCH /api/v1/incidents/:id/status` et `GET /api/v1/incidents/:id/timeline`.
- `GET /api/v1/resources` et `PATCH /api/v1/resources/:id/location`.
- `POST /api/v1/incidents/:id/assignments`.
- `GET/PATCH /api/v1/interventions`.
- `GET /api/v1/facilities` et `PUT /api/v1/facilities/:id/capacities`.
- `POST /api/v1/interventions/:id/admissions`, `GET/PATCH /api/v1/admissions`.
- `GET/PATCH /api/v1/zem/applications`.
- `GET/PATCH /api/v1/notifications` : notifications et accusés de lecture.
- `GET /api/v1/audit` : journal réservé à l’administrateur.
- `GET /api/v1/organizations/:id/members`, `POST /api/v1/organizations/:id/agents` et désactivation d’un membre.
- `GET /accidents/geojson`, `GET /accidents/stats` et `GET /responders` : compatibilité historique protégée et affichée dans la console.
- `GET /auth/me` : session, rôles, permissions et organisation.

L’inventaire détaillé des payloads et réponses se trouve dans `backend/API_CONTRACT.md`.

## Temps réel et RLS

La migration publie les tables opérationnelles dans Supabase Realtime et installe des politiques RLS par rôle/organisation. Le backend émet un jeton Realtime court lorsque `SUPABASE_JWT_SECRET` est configuré. Les mutations sensibles passent toujours par le backend avec JWT/RBAC ; le polling authentifié reste le repli si Realtime n'est pas configuré.

## Rollback non destructif

Redéployer la version backend précédente et désactiver la console. Les nouvelles tables peuvent rester en place sans affecter les tables historiques. Ne pas exécuter de `DROP TABLE` en production.

## Variables d’environnement

Backend uniquement : `DATABASE_URL`, `JWT_SECRET`, `SUPABASE_JWT_SECRET`, `CORS_ORIGINS`, et éventuellement `ENABLE_LEGACY_PRO_LOGIN=false` / `ENABLE_LEGACY_SCAN_CODES=false`. Les deux secrets JWT ne doivent jamais être préfixés par `VITE_`.

Console : `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_CITIZEN_URL`. La clé anon est publique par conception; aucune service-role key ne doit se trouver dans un client.

Web/mobile : leurs URL API et paramètres publics Supabase existants doivent pointer vers le même projet et le même backend.

## Comptes et tests locaux

Ne pas versionner de compte prédéfini. Créer un admin local avec `INITIAL_ADMIN_PHONE` et un mot de passe temporaire aléatoire d’au moins 12 caractères, exécuter `npm run create-admin`, puis supprimer ces variables. Les autres comptes sont créés depuis la console; un gestionnaire hospitalier peut créer seulement des agents de son établissement.

Pour une recette locale complète :

1. Appliquer la migration sur une base de développement vide ou restaurée.
2. Exécuter `npm test` dans `backend/`, `npm run build` dans `frontend/` et la console, puis `npx tsc --noEmit` dans `Qr-mobile/`.
3. Créer deux organisations hospitalières et deux services d’urgence.
4. Tester une connexion pour chacun des neuf rôles et vérifier qu’un citoyen/Zem est refusé par la console.
5. Soumettre une inscription citoyenne, puis une demande Zem; vérifier qu’aucune course conducteur n’est possible avant approbation.
6. Créer un SOS depuis web et mobile et vérifier le même endpoint `POST /api/v1/incidents` et l’apparition console.
7. Valider, affecter, accepter, envoyer la position, arriver sur place et prendre en charge.
8. Demander une admission; tester refus puis nouvelle demande acceptée, transport, arrivée et clôture.
9. Connecter des comptes de deux organisations et vérifier les réponses 403/404 hors périmètre.
10. Observer les événements Realtime pour incidents, interventions, positions, capacités, admissions et notifications; couper Realtime et vérifier le polling de repli.
11. Vérifier le journal admin et confirmer que `?demo=1` est le seul moyen d’afficher les scénarios simulés.

Commandes de validation automatisées disponibles dans `backend/` :

- `npm test` : compilation et tests JWT/RBAC/workflows/migration.
- `npm run verify:schema` : vérifie 14 tables, 6 publications Realtime et 6 politiques RLS sur Supabase.
- `npm run inspect:operations` : affiche uniquement des volumes non personnels.
- `npm run smoke:operations` : connexion admin réelle, 13 lectures API, jeton Realtime et refus RBAC citoyen.
- `npm run verify:workflow` : crée un scénario complet dans une transaction PostgreSQL puis exécute systématiquement `ROLLBACK`; aucune donnée de test n’est conservée.

Sans base accessible, les builds et tests unitaires prouvent la validité statique mais ne remplacent pas cette recette d’intégration.
