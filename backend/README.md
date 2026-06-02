# LOTISEC Backend (Node.js)

Backend Node.js/TypeScript compatible avec les flux existants mobile/web.

## Installation

```bash
cd backend
npm install
cp .env.example .env
```

Renseigner `.env`:

- `DATABASE_URL`
- `JWT_SECRET`
- `PORT`

## Lancement

```bash
npm run dev
```

## Endpoints principaux

- `POST /auth/register`
- `POST /auth/login`
- `POST /profil/` (Bearer token)
- `GET /profil/scan/:token`
- `POST /scan/verify`
- `POST /scan/`
- `GET /scans/historique`
- `POST /alertes`
- `GET /alertes`
- `PUT /alertes/:id/prendre-en-charge`
- `PUT /alertes/:id/resoudre`
- `POST /accidents`
- `GET /accidents/geojson`
- `GET /accidents/stats`
- `GET /geo/hotspots`
- `GET /geo/hopital-proche?lat=&lng=`

## WebSocket

- `ws://localhost:8000/ws/alertes`
- Ping/Pong supporte.
