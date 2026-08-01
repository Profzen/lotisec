# Contrat API - LOTISEC

Ce document définit les spécifications des routes exposées par le backend Node.js (Express + Supabase).
**Base URL Production :** `https://lotisec-backend.vercel.app`

Toutes les requêtes modifiant des données ou accédant à des informations sensibles nécessitent un token JWT valide dans le header `Authorization: Bearer <token>`.

---

## 1. Authentification (`/auth` et `/pro`)

### 1.1 Inscription (Citoyen)
- **POST** `/auth/register`
- **Body :**
  ```json
  {
    "phone": "+22890000000",
    "password": "motdepassesecurise",
    "account_type": "citizen"
  }
  ```

Pour un conducteur, utiliser `account_type: "zem_driver"` et ajouter `zem_application` avec `identity_document`, `license_number`, `motorcycle_make`, `motorcycle_model`, `plate` et `work_zone`. Le compte reste citoyen et la demande reste `pending` jusqu’à approbation.
- **Réponse (201 Created) :**
  ```json
  {
    "message": "Utilisateur créé avec succès",
    "user": {
      "id": "uuid",
      "phone": "+22890000000"
    },
    "token": "eyJhb..."
  }
  ```

### 1.2 Connexion (Citoyen)
- **POST** `/auth/login`
- **Body :**
  ```json
  {
    "phone": "+22890000000",
    "password": "motdepassesecurise"
  }
  ```
- **Réponse (200 OK) :**
  ```json
  {
    "message": "Connexion réussie",
    "user": {
      "id": "uuid",
      "phone": "+22890000000"
    },
    "token": "eyJhb..."
  }
  ```

### 1.3 Connexion Professionnelle (Dashboard)
- **POST** `/pro/login`
- **Body :**
  ```json
  {
    "code_institutionnel": "SAMU-CHU-0812",
    "password": "safelife2024"
  }
  ```
- **Réponse (200 OK) :**
  ```json
  {
    "message": "Connexion pro réussie",
    "pro": {
      "id": "uuid",
      "type": "samu",
      "nom": "SAMU CHU Sylvanus Olympio"
    },
    "token": "eyJhb..."
  }
  ```

---

## 2. Profil Médical et QR Code (`/profil`)

### 2.1 Création/Mise à jour du Profil
- **POST / PUT** `/profil`
- **Header :** `Authorization: Bearer <token>`
- **Body :**
  ```json
  {
    "prenom": "Jean",
    "nom": "Dupont",
    "date_naissance": "1990-01-01",
    "groupe_sanguin": "O+",
    "contacts_urgence": [
      { "nom": "Marie", "telephone": "+22890000001", "relation": "Soeur" }
    ]
  }
  ```
- **Réponse (200 OK) :**
  ```json
  {
    "message": "Profil mis à jour",
    "qr_token": "lotisec-abc-123"
  }
  ```

---

## 3. Gestion des Urgences (SOS)

### 3.1 Déclencher un SOS
- **POST** `/alertes`
- **Header :** `Authorization: Bearer <token>` (Optionnel si non connecté)
- **Body :**
  ```json
  {
    "latitude": 6.136629,
    "longitude": 1.222186,
    "user_id": "uuid",
    "qr_token": "lotisec-abc-123",
    "prenom": "Jean",
    "nom": "Dupont",
    "groupe_sanguin": "O+"
  }
  ```
- **Réponse (201 Created) :**
  ```json
  {
    "message": "Alerte envoyée avec succès",
    "alerte_id": "uuid"
  }
  ```
*(Déclenche un événement WebSocket `NOUVELLE_ALERTE` vers les dashboards)*

---

## 4. Données Géodécisionnelles (`/geo`)

### 4.1 Hôpital le plus proche (Routage OSRM/PostGIS)
- **GET** `/geo/hopital-proche?lat=6.13&lng=1.22`
- **Réponse (200 OK) :**
  ```json
  [
    {
      "id": "uuid",
      "name": "CHU Sylvanus Olympio",
      "type": "hopital",
      "address": "Lomé, Togo",
      "phone": "118",
      "urgences": true,
      "distance_km": "2.4",
      "latitude": 6.14,
      "longitude": 1.23
    }
  ]
  ```

---

## 5. Module Zem (Ride-hailing)

### 5.1 Commander un Zem
- **POST** `/zem/request`
- **Header :** `Authorization: Bearer <token>`
- **Body :**
  ```json
  {
    "depart_lat": 6.13,
    "depart_lng": 1.22,
    "dest_lat": 6.15,
    "dest_lng": 1.24,
    "destination_nom": "Aéroport LFW",
    "distance_km": 4.2,
    "prix_fcfa": 350
  }
  ```
- **Réponse (201 Created) :**
  ```json
  {
    "message": "Course demandée",
    "ride_id": "uuid"
  }
  ```

### 5.2 Mettre à jour la position Zem (Conducteur)
- **POST** `/zem/location`
- **Header :** `Authorization: Bearer <token>`
- **Body :**
  ```json
  {
    "latitude": 6.13,
    "longitude": 1.22,
    "is_online": true
  }
  ```
- **Réponse (200 OK)**

---

*Fin du contrat API.*
# API opérationnelle v1 — ajout 2026-07-31

Toutes les routes ci-dessous utilisent `Authorization: Bearer <JWT>`. Le JWT contient les rôles, permissions et l'organisation active. Les mutations sont contrôlées par RBAC et par transitions d'état.

| Méthode | Route | Permission/portée |
|---|---|---|
| GET | `/auth/me` | session courante |
| POST | `/auth/realtime-token` | session courante, si Realtime configuré |
| POST | `/api/v1/incidents` | utilisateur authentifié |
| GET | `/api/v1/incidents` | `incidents:read` |
| PATCH | `/api/v1/incidents/:id/status` | `incidents:manage` |
| GET | `/api/v1/incidents/:id/timeline` | `incidents:read` |
| POST | `/api/v1/incidents/:id/assignments` | `interventions:manage` |
| GET | `/api/v1/interventions` | supervision ou missions de l'organisation |
| PATCH | `/api/v1/interventions/:id/status` | gestionnaire ou intervenant affecté |
| GET | `/api/v1/resources` | ressources globales ou de l'organisation |
| PATCH | `/api/v1/resources/:id/location` | intervenant/gestionnaire autorisé |
| GET | `/api/v1/facilities` | utilisateur authentifié |
| PUT | `/api/v1/facilities/:id/capacities` | `facilities:manage`, même organisation |
| POST | `/api/v1/interventions/:id/admissions` | équipe/gestionnaire de l'intervention |
| GET | `/api/v1/admissions` | supervision ou hôpital courant |
| PATCH | `/api/v1/admissions/:id/status` | hôpital ciblé uniquement |
| GET/PATCH | `/api/v1/zem/applications` | `zem:approve` |
| POST | `/api/v1/admin/users` | `admin:manage` |
| POST/DELETE | `/api/v1/admin/users/:id/roles` | `admin:manage` |
| POST | `/api/v1/organizations` | `admin:manage` |
| PATCH | `/zem/rides/:id/status` | passager ou Zem associé |

États incidents : `new → validated → assigned → en_route → on_scene → patient_loaded → to_hospital → arrived_hospital → completed`, avec branches `rejected` et `cancelled` contrôlées.

États interventions : `assigned → accepted → en_route → on_scene → patient_loaded → hospital_requested → to_hospital → arrived_hospital → completed`.
# Extensions institutionnelles 2026

Toutes les routes ci-dessous exigent `Authorization: Bearer <jwt>` et appliquent les permissions/session d’organisation.

- `GET /api/v1/notifications` retourne uniquement les notifications visant l’utilisateur, ses rôles ou son organisation.
- `PATCH /api/v1/notifications/:id/read` enregistre une lecture propre à l’utilisateur.
- `GET /api/v1/audit` exige `admin:manage`.
- `GET /api/v1/organizations/:id/members` exige `organization:members` dans l’organisation active, ou admin.
- `POST /api/v1/organizations/:id/agents` crée un agent hospitalier avec un mot de passe temporaire de 12 caractères minimum.
- `DELETE /api/v1/organizations/:id/members/:userId` désactive l’appartenance et retire ses rôles institutionnels sans supprimer l’utilisateur.
