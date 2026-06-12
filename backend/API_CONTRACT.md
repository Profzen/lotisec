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
    "password": "motdepassesecurise"
  }
  ```
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
