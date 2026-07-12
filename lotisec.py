import os
import sys

# ------------------------------------------------------------
# FORCER LE CACHE HUGGING FACE DANS UN DOSSIER LOCAL
# (À faire AVANT tout autre import pouvant utiliser HF)
# ------------------------------------------------------------
CACHE_DIR = os.path.join(os.getcwd(), "hf_cache")
os.makedirs(CACHE_DIR, exist_ok=True)  # Crée le dossier si nécessaire

os.environ["HF_HOME"] = CACHE_DIR
os.environ["TRANSFORMERS_CACHE"] = CACHE_DIR
os.environ["HUGGINGFACE_HUB_CACHE"] = CACHE_DIR

# ------------------------------------------------------------
# IMPORT DES AUTRES BIBLIOTHÈQUES
# ------------------------------------------------------------
import streamlit as st
import requests
import speech_recognition as sr
from gtts import gTTS
import tempfile
import hashlib
import pdfplumber
import numpy as np
from sentence_transformers import SentenceTransformer
import faiss
from typing import List, Tuple

# ------------------ CONFIGURATION ------------------
DEEPINFRA_API_KEY = "ivaDF0RR9kyf3RG14aZgkAb5y3i3MrtA"
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

# ------------------ GESTION DU RAG (PDF) ------------------
@st.cache_resource
def load_embedding_model():
    """Charge le modèle d'embedding en utilisant le cache local forcé."""
    try:
        # On utilise explicitement le dossier de cache créé plus haut
        return SentenceTransformer('all-MiniLM-L6-v2', cache_folder=CACHE_DIR)
    except Exception as e:
        st.error(f"Erreur lors du chargement du modèle d'embedding : {e}")
        st.stop()

def extract_text_from_pdf(pdf_file) -> str:
    text = ""
    with pdfplumber.open(pdf_file) as pdf:
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

def search_relevant_chunks(query: str, chunks: List[str], index: faiss.IndexFlatL2, model, top_k: int = 3) -> List[str]:
    query_embedding = model.encode([query])
    distances, indices = index.search(query_embedding.astype(np.float32), top_k)
    relevant = [chunks[idx] for idx in indices[0] if idx != -1]
    return relevant

# ------------------ APPEL DEEPINFRA AVEC CONTEXTE RAG ------------------
def call_deepinfra_with_rag(question, history, context_doc: str = None):
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
    for q, r in history[-5:]:
        messages.append({"role": "user", "content": q})
        messages.append({"role": "assistant", "content": r})
    messages.append({"role": "user", "content": question})

    payload = {
        "model": MODEL,
        "messages": messages,
        "temperature": 0.6
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        return f"Désolé, erreur technique : {str(e)}"

# ------------------ SPEECH-TO-TEXT ------------------
def transcribe_audio(audio_bytes):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name
    recognizer = sr.Recognizer()
    with sr.AudioFile(tmp_path) as source:
        audio_data = recognizer.record(source)
    text = recognizer.recognize_google(audio_data, language="fr-FR")
    os.unlink(tmp_path)
    return text

# ------------------ TEXT-TO-SPEECH ------------------
def text_to_speech(text, lang="fr"):
    if not text.strip():
        return None
    filename = hashlib.md5(f"{lang}_{text}".encode()).hexdigest() + ".mp3"
    if not os.path.exists(filename):
        tts = gTTS(text=text, lang=lang)
        tts.save(filename)
    return filename

# ------------------ INTERFACE STREAMLIT ------------------
st.set_page_config(page_title="LOTISEC", layout="wide")
st.title("🚦 LOTISEC - Assistant Code de la route")
st.caption("Posez vos questions (voix ou texte) – je réponds en français.")

with st.sidebar:
    st.header("📄 Document PDF (RAG)")
    uploaded_pdf = st.file_uploader("Chargez un PDF (code de la route, règlement...)", type=["pdf"])
    if uploaded_pdf is not None:
        with st.spinner("Extraction et indexation du PDF..."):
            full_text = extract_text_from_pdf(uploaded_pdf)
            if full_text:
                chunks = chunk_text(full_text, chunk_size=500, overlap=100)
                st.success(f"PDF chargé : {len(chunks)} fragments extraits.")
                model = load_embedding_model()
                index, _ = build_faiss_index(chunks, model)
                st.session_state.pdf_chunks = chunks
                st.session_state.pdf_index = index
                st.session_state.pdf_model = model
                st.session_state.pdf_loaded = True
            else:
                st.error("Impossible d'extraire le texte du PDF. Vérifiez qu'il n'est pas scanné.")
    else:
        st.session_state.pdf_loaded = False

if "history" not in st.session_state:
    st.session_state.history = []
if "messages" not in st.session_state:
    st.session_state.messages = []

for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

def respond_to_query(user_query: str, use_voice_output: bool = True):
    st.chat_message("user").markdown(user_query)
    st.session_state.messages.append({"role": "user", "content": user_query})

    context_for_prompt = None
    if st.session_state.get("pdf_loaded", False):
        with st.spinner("Recherche dans le document..."):
            relevant_chunks = search_relevant_chunks(
                user_query,
                st.session_state.pdf_chunks,
                st.session_state.pdf_index,
                st.session_state.pdf_model,
                top_k=3
            )
            if relevant_chunks:
                context_for_prompt = "\n\n---\n".join(relevant_chunks)
                st.info(f"📖 {len(relevant_chunks)} passage(s) trouvé(s) dans le PDF.")

    with st.spinner("LOTISEC réfléchit..."):
        assistant_reply = call_deepinfra_with_rag(user_query, st.session_state.history, context_for_prompt)

    with st.chat_message("assistant"):
        st.markdown(assistant_reply)
    st.session_state.messages.append({"role": "assistant", "content": assistant_reply})
    st.session_state.history.append((user_query, assistant_reply))

    if use_voice_output:
        audio_file = text_to_speech(assistant_reply, lang="fr")
        if audio_file and os.path.exists(audio_file):
            with open(audio_file, "rb") as f:
                st.audio(f.read(), format="audio/mp3")

st.markdown("---")
st.subheader("🎤 Posez votre question vocalement")
audio_value = st.audio_input("Cliquez pour enregistrer")

if audio_value:
    try:
        user_text = transcribe_audio(audio_value.getvalue())
        if user_text and user_text.strip():
            st.info(f"Vous avez dit : {user_text}")
            respond_to_query(user_text, use_voice_output=True)
        else:
            st.warning("Je n'ai pas compris l'audio. Veuillez réessayer.")
    except Exception as e:
        st.error(f"Erreur de transcription : {e}")

st.markdown("---")
st.subheader("⌨️ Ou écrivez votre question")
if prompt := st.chat_input("Votre message ici..."):
    respond_to_query(prompt, use_voice_output=True)

if st.sidebar.button("🗑️ Effacer la conversation"):
    st.session_state.history = []
    st.session_state.messages = []
    st.rerun()