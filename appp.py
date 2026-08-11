"""API IA canonique LOTISEC.

Cette version reprend la détection d'urgence et la recherche d'établissements
du prototype fourni par l'équipe, puis expose le contrat attendu par le web et
l'application Expo : /chat, /transcribe, /tts, /voice et /health.
"""
from __future__ import annotations

import base64
import io
import math
import os
import re
import tempfile
import unicodedata
from typing import Literal

import requests
import speech_recognition as sr
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from gtts import gTTS
from pydantic import BaseModel, Field

DEEPINFRA_API_KEY = os.getenv("DEEPINFRA_API_KEY", "").strip()
DEEPINFRA_MODEL = os.getenv("DEEPINFRA_MODEL", "meta-llama/Llama-3.3-70B-Instruct")
MAX_AUDIO_BYTES = 12 * 1024 * 1024
ALLOWED_ORIGINS = [value.strip() for value in os.getenv("CORS_ORIGINS", "*").split(",") if value.strip()]

app = FastAPI(title="LOTISEC AI Service", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=ALLOWED_ORIGINS != ["*"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

EMERGENCY_KEYWORDS = {
    "urgence", "accident", "inconscient", "ne respire pas", "hemorragie",
    "saigne beaucoup", "douleur poitrine", "avc", "convulsion", "overdose",
    "fracture", "brulure grave", "coma", "etouffement", "noyade",
    "morsure de serpent", "suicide", "crise cardiaque", "crise d asthme",
}
NEGATIONS = {"pas de", "aucun", "aucune", "sans", "n ai pas", "jamais eu"}
HOSPITAL_KEYWORDS = {"hopital", "clinique", "centre de sante", "pharmacie", "medecin", "dispensaire", "infirmerie", "proche"}
LOCAL_HEALTH_PLACES = [
    {"name": "CHU Sylvanus Olympio", "type": "hospital", "latitude": 6.1374, "longitude": 1.2122},
    {"name": "CHU Campus Lomé", "type": "hospital", "latitude": 6.1756, "longitude": 1.2137},
    {"name": "Hôpital de Bè", "type": "hospital", "latitude": 6.1322, "longitude": 1.2402},
    {"name": "Hôpital Dogta-Lafiè", "type": "hospital", "latitude": 6.2023, "longitude": 1.1854},
    {"name": "Polyclinique Saint-Joseph", "type": "clinic", "latitude": 6.1645, "longitude": 1.2311},
    {"name": "Clinique Biasa", "type": "clinic", "latitude": 6.1512, "longitude": 1.2085},
]

SYSTEM_PROMPT = """Tu es l'assistant LOTISEC pour la sécurité routière et les premiers gestes d'urgence au Togo.
Réponds en français, en 3 à 5 phrases courtes, avec un ton calme et professionnel.
En urgence, commence par les actions immédiates et rappelle le 118. Ne pose jamais de diagnostic,
ne remplace pas un professionnel de santé et n'invente aucune règle. Pour une recherche de soins,
explique que les résultats géolocalisés sont indicatifs et qu'il faut appeler avant de se déplacer."""


def normalize(text: str) -> str:
    return "".join(char for char in unicodedata.normalize("NFKD", text.lower()) if not unicodedata.combining(char))


def contains_non_negated(text: str, keywords: set[str]) -> bool:
    value = normalize(text)
    for keyword in keywords:
        index = value.find(normalize(keyword))
        if index >= 0 and not any(normalize(negation) in value[max(0, index - 24):index] for negation in NEGATIONS):
            return True
    return False


def is_emergency(text: str) -> bool:
    return contains_non_negated(text, EMERGENCY_KEYWORDS)


def needs_hospital_search(text: str) -> bool:
    return any(normalize(keyword) in normalize(text) for keyword in HOSPITAL_KEYWORDS)


def nearby_places(latitude: float, longitude: float, radius_m: int) -> list[dict]:
    places = []
    for place in LOCAL_HEALTH_PLACES:
        lat1,lat2=math.radians(latitude),math.radians(place["latitude"])
        delta_lat=math.radians(place["latitude"]-latitude);delta_lon=math.radians(place["longitude"]-longitude)
        haversine=math.sin(delta_lat/2)**2+math.cos(lat1)*math.cos(lat2)*math.sin(delta_lon/2)**2
        distance=6371*2*math.atan2(math.sqrt(haversine),math.sqrt(1-haversine))
        if distance <= radius_m / 1000:
            places.append({**place, "distance_km": round(distance, 2), "maps_url": f"https://www.google.com/maps?q={place['latitude']},{place['longitude']}"})
    return sorted(places, key=lambda item: item["distance_km"])[:10]


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    history: list[ChatMessage] = Field(default_factory=list)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    radius_m: int = Field(default=10000, ge=1000, le=30000)


class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1500)
    language: Literal["fr"] = "fr"


def fallback_answer(question: str, emergency: bool) -> str:
    if emergency:
        return "Appelez immédiatement le 118. Sécurisez la zone sans vous mettre en danger, ne déplacez pas la victime sauf danger immédiat et suivez les instructions des secours. LOTISEC ne remplace pas un professionnel de santé."
    return "Le service de réponse intelligente est temporairement indisponible. Pour une urgence, appelez le 118. Reformulez votre question ou réessayez dans quelques instants."


def answer_question(request: ChatRequest) -> dict:
    emergency = is_emergency(request.question)
    places = nearby_places(request.latitude, request.longitude, request.radius_m) if needs_hospital_search(request.question) and request.latitude is not None and request.longitude is not None else []
    if not DEEPINFRA_API_KEY:
        return {"response": fallback_answer(request.question, emergency), "emergency": emergency, "places": places, "mode": "safe_fallback"}
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(message.model_dump() for message in request.history[-8:])
    messages.append({"role": "user", "content": request.question})
    try:
        response = requests.post(
            "https://api.deepinfra.com/v1/openai/chat/completions",
            headers={"Authorization": f"Bearer {DEEPINFRA_API_KEY}", "Content-Type": "application/json"},
            json={"model": DEEPINFRA_MODEL, "messages": messages, "temperature": 0.35, "max_tokens": 450},
            timeout=45,
        )
        response.raise_for_status()
        answer = response.json()["choices"][0]["message"]["content"].strip()
    except Exception as error:
        print(f"DeepInfra chat unavailable: {error}")
        answer = fallback_answer(request.question, emergency)
    if emergency and "118" not in answer:
        answer = f"Appelez immédiatement le 118. {answer}"
    return {"response": answer, "emergency": emergency, "places": places, "mode": "generative" if DEEPINFRA_API_KEY else "safe_fallback"}


async def read_audio(file: UploadFile) -> bytes:
    content = await file.read(MAX_AUDIO_BYTES + 1)
    if not content:
        raise HTTPException(400, "Fichier audio vide")
    if len(content) > MAX_AUDIO_BYTES:
        raise HTTPException(413, "Fichier audio trop volumineux")
    return content


def transcribe_bytes(content: bytes, filename: str, content_type: str) -> str:
    if DEEPINFRA_API_KEY:
        try:
            response = requests.post(
                "https://api.deepinfra.com/v1/openai/audio/transcriptions",
                headers={"Authorization": f"Bearer {DEEPINFRA_API_KEY}"},
                data={"model": os.getenv("DEEPINFRA_STT_MODEL", "openai/whisper-large-v3-turbo"), "language": "fr"},
                files={"file": (filename or "audio.webm", content, content_type or "application/octet-stream")},
                timeout=60,
            )
            response.raise_for_status()
            text = str(response.json().get("text", "")).strip()
            if text:
                return text
        except Exception as error:
            print(f"DeepInfra transcription unavailable: {error}")
    suffix = os.path.splitext(filename or "audio.wav")[1].lower()
    if suffix not in {".wav", ".flac", ".aiff", ".aif"}:
        raise HTTPException(503, "La transcription de ce format nécessite le fournisseur audio configuré")
    path = ""
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temporary:
            temporary.write(content)
            path = temporary.name
        recognizer = sr.Recognizer()
        with sr.AudioFile(path) as source:
            return recognizer.recognize_google(recognizer.record(source), language="fr-FR")
    except sr.UnknownValueError as error:
        raise HTTPException(422, "Audio incompréhensible") from error
    except sr.RequestError as error:
        raise HTTPException(503, "Service de transcription indisponible") from error
    finally:
        if path and os.path.exists(path):
            os.unlink(path)


def synthesize_bytes(text: str) -> bytes:
    output = io.BytesIO()
    try:
        gTTS(text=text, lang="fr", slow=False).write_to_fp(output)
    except Exception as error:
        raise HTTPException(503, "Synthèse vocale indisponible") from error
    return output.getvalue()


@app.post("/chat")
def chat_endpoint(request: ChatRequest):
    return answer_question(request)


@app.post("/transcribe")
async def transcribe_endpoint(file: UploadFile = File(...)):
    content = await read_audio(file)
    return {"text": transcribe_bytes(content, file.filename or "audio.webm", file.content_type or "application/octet-stream")}


@app.post("/tts")
def tts_endpoint(request: TTSRequest):
    return StreamingResponse(io.BytesIO(synthesize_bytes(request.text)), media_type="audio/mpeg", headers={"Cache-Control": "no-store"})


@app.post("/voice")
async def voice_endpoint(file: UploadFile = File(...), latitude: float | None = None, longitude: float | None = None):
    content = await read_audio(file)
    transcript = transcribe_bytes(content, file.filename or "audio.webm", file.content_type or "application/octet-stream")
    result = answer_question(ChatRequest(question=transcript, latitude=latitude, longitude=longitude))
    result.update({"text": transcript, "audio_base64": base64.b64encode(synthesize_bytes(result["response"])).decode("ascii"), "audio_mime_type": "audio/mpeg"})
    return result


@app.get("/health")
def health_endpoint():
    return {"status": "ok", "service": "lotisec-ai", "version": "2.0.0", "chat_ready": bool(DEEPINFRA_API_KEY), "transcription": "deepinfra_or_wav_fallback", "tts": "gtts"}
