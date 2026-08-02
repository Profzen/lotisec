import os
import sys

# Cache Hugging Face
CACHE_DIR = os.path.join(os.getcwd(), "hf_cache")
os.makedirs(CACHE_DIR, exist_ok=True)
os.environ["HF_HOME"] = CACHE_DIR
os.environ["TRANSFORMERS_CACHE"] = CACHE_DIR
os.environ["HUGGINGFACE_HUB_CACHE"] = CACHE_DIR

import requests
import speech_recognition as sr
from gtts import gTTS
import tempfile
import hashlib
import pdfplumber
import numpy as np
from sentence_transformers import SentenceTransformer
import faiss
from typing import List, Tuple, Optional
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncio
from concurrent.futures import ThreadPoolExecutor

app = FastAPI(title="LOTISEC AI Service")

# CORS to allow frontend/mobile to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DEEPINFRA_API_KEY = os.environ.get("DEEPINFRA_API_KEY", "")
MODEL = "meta-llama/Llama-3.3-70B-Instruct"

BASE_SYSTEM_PROMPT = """
Tu es LOTISEC, un assistant intelligent spécialisé dans le code de la route, la sécurité routière et les procédures d'urgence au Togo.

MISSION
Ton rôle est d'informer, sensibiliser et accompagner les usagers de la route en fournissant des réponses fiables, claires et pédagogiques.

RÈGLES GÉNÉRALES
- Réponds toujours en français.
- Utilise un langage simple et compréhensible.
- Adapte tes explications aux personnes ayant peu de connaissances en sécurité routière.
- Sois poli, patient et professionnel.
- Donne des réponses précises et structurées.
- Lorsque cela est utile, utilise des listes à puces ou des étapes numérotées.
- **IMPORTANT**: TES RÉPONSES DOIVENT ÊTRE COURTES ET CONCISES POUR UNE APPLICATION MOBILE/CHAT. MAXIMUM 3-4 PHRASES COURTES.

DOMAINES DE COMPÉTENCE
- Le code de la route.
- La signalisation routière.
- Les règles de circulation.
- La sécurité routière.
- Les comportements à adopter en cas d'accident.
- Les équipements obligatoires des véhicules.
- Les sanctions liées aux infractions routières.
- La prévention des accidents.
- Les bonnes pratiques de conduite.

PANNEAUX DE SIGNALISATION
Explique leur signification, le comportement attendu et donne un exemple.

RÈGLES DE CIRCULATION
Explique limitations de vitesse, priorités, dépassements, stationnement, feux, passages piétons, ronds-points, distances de sécurité.

SÉCURITÉ ROUTIÈRE
Rappelle le port de la ceinture, du casque, l'interdiction de l'alcool/drogues/téléphone au volant, l'entretien du véhicule.

ACCIDENTS DE LA ROUTE
1. Sécuriser la zone.
2. Protéger les victimes.
3. Alerter les secours.
4. Fournir les premiers renseignements.
5. Ne pas déplacer un blessé sauf danger immédiat.

STYLE DE RÉPONSE
Réponds comme un formateur en sécurité routière, avec des exemples simples, toujours en priorisant la sécurité.

LIMITES
N'invente jamais une règle. Si une info réglementaire précise est inconnue, dis-le clairement. Ne donne jamais de conseils dangereux.
"""

# Global State for RAG
pdf_chunks = []
pdf_index = None
embedding_model = None

def load_embedding_model():
    print("Loading embedding model...")
    return SentenceTransformer('all-MiniLM-L6-v2', cache_folder=CACHE_DIR)

def extract_text_from_pdf(pdf_path) -> str:
    text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    return text

def chunk_text(text: str, chunk_size: int = 500, overlap: int = 100) -> List[str]:
    words = text.split()
    chunks = []
    for i in range(0, len(words), chunk_size - overlap):
        chunk = " ".join(words[i:i + chunk_size])
        if chunk:
            chunks.append(chunk)
    return chunks

def build_faiss_index(chunks: List[str], model) -> Tuple[faiss.IndexFlatL2, np.ndarray]:
    embeddings = model.encode(chunks)
    dimension = embeddings.shape[1]
    index = faiss.IndexFlatL2(dimension)
    index.add(embeddings.astype(np.float32))
    return index, embeddings

@app.on_event("startup")
async def startup_event():
    global pdf_chunks, pdf_index, embedding_model
    
    # Run heavy loading in a separate thread to not block event loop
    loop = asyncio.get_event_loop()
    with ThreadPoolExecutor() as pool:
        embedding_model = await loop.run_in_executor(pool, load_embedding_model)
        
        pdf_path = os.path.join(os.getcwd(), "default_code.pdf")
        if os.path.exists(pdf_path):
            print(f"Loading default PDF: {pdf_path}")
            text = extract_text_from_pdf(pdf_path)
            if text:
                pdf_chunks = chunk_text(text)
                pdf_index, _ = build_faiss_index(pdf_chunks, embedding_model)
                print(f"Loaded {len(pdf_chunks)} chunks into FAISS index.")
        else:
            print(f"No default PDF found at {pdf_path}. RAG will be disabled until a PDF is provided.")

def search_relevant_chunks(query: str, chunks: List[str], index: faiss.IndexFlatL2, model, top_k: int = 3) -> List[str]:
    query_embedding = model.encode([query])
    distances, indices = index.search(query_embedding.astype(np.float32), top_k)
    relevant = [chunks[idx] for idx in indices[0] if idx != -1]
    return relevant

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    question: str
    history: List[ChatMessage] = []

@app.post("/chat")
def chat_endpoint(req: ChatRequest):
    context_doc = None
    if pdf_index is not None and pdf_chunks and embedding_model:
        relevant_chunks = search_relevant_chunks(req.question, pdf_chunks, pdf_index, embedding_model, top_k=3)
        if relevant_chunks:
            context_doc = "\n\n---\n".join(relevant_chunks)
            
    if context_doc:
        augmented_system = BASE_SYSTEM_PROMPT + f"\n\nCONTEXTE DU DOCUMENT (utilise ces informations en priorité):\n{context_doc}\n\nRéponds en t'appuyant sur ce contexte si la question s'y rapporte. Si l'information n'est pas dans le contexte, réponds avec tes connaissances générales du code de la route."
    else:
        augmented_system = BASE_SYSTEM_PROMPT

    url = "https://api.deepinfra.com/v1/openai/chat/completions"
    headers = {
        "Authorization": f"Bearer {DEEPINFRA_API_KEY}",
        "Content-Type": "application/json"
    }
    
    messages = [{"role": "system", "content": augmented_system}]
    for msg in req.history[-5:]:
        messages.append({"role": msg.role, "content": msg.content})
        
    messages.append({"role": "user", "content": req.question})

    payload = {
        "model": MODEL,
        "messages": messages,
        "temperature": 0.6
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        reply = response.json()["choices"][0]["message"]["content"].strip()
        return {"response": reply}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur technique: {str(e)}")

@app.post("/transcribe")
async def transcribe_endpoint(file: UploadFile = File(...)):
    try:
        content = await file.read()
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            tmp.write(content)
            tmp_path = tmp.name
            
        recognizer = sr.Recognizer()
        with sr.AudioFile(tmp_path) as source:
            audio_data = recognizer.record(source)
            
        text = recognizer.recognize_google(audio_data, language="fr-FR")
        os.unlink(tmp_path)
        return {"text": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class TTSRequest(BaseModel):
    text: str

@app.post("/tts")
def tts_endpoint(req: TTSRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text is empty")
        
    audio_dir = os.path.join(os.getcwd(), "audio_cache")
    os.makedirs(audio_dir, exist_ok=True)
    
    filename = hashlib.md5(f"fr_{req.text}".encode()).hexdigest() + ".mp3"
    filepath = os.path.join(audio_dir, filename)
    
    if not os.path.exists(filepath):
        try:
            tts = gTTS(text=req.text, lang="fr")
            tts.save(filepath)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
            
    return FileResponse(filepath, media_type="audio/mpeg", filename=filename)

@app.get("/health")
def health():
    return {"status": "ok", "rag_ready": pdf_index is not None}
