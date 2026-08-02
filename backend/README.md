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
# Assistant IA unifié (Vercel + Supabase)

L’assistant est servi par le backend principal sous `/ai` :

- `GET /ai/health`
- `POST /ai/chat`
- `POST /ai/transcribe` (`multipart/form-data`, champ `file`)
- `POST /ai/tts`

Variables Vercel obligatoires : `DEEPINFRA_API_KEY`. Les modèles peuvent être remplacés avec
`AI_CHAT_MODEL`, `AI_EMBEDDING_MODEL`, `AI_TRANSCRIPTION_MODEL` et `AI_TTS_MODEL`.

Provisionnement initial :

```powershell
npm run migrate:ai
npm run rag:index
```

La seconde commande lit par défaut `../default_code.pdf`. Elle doit être relancée après chaque
modification du document de référence. Elle remplace atomiquement les anciens fragments.
