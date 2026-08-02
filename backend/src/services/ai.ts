import { query } from '../database';

const DEEPINFRA_BASE = 'https://api.deepinfra.com';
const CHAT_MODEL = process.env.AI_CHAT_MODEL || 'meta-llama/Llama-3.3-70B-Instruct';
const EMBEDDING_MODEL = process.env.AI_EMBEDDING_MODEL || 'BAAI/bge-m3';
const TRANSCRIPTION_MODEL = process.env.AI_TRANSCRIPTION_MODEL || 'openai/whisper-large';
const TTS_MODEL = process.env.AI_TTS_MODEL || 'hexgrad/Kokoro-82M';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

const SYSTEM_PROMPT = `Tu es LOTISEC, un assistant spécialisé dans le code de la route, la sécurité routière et les procédures d'urgence au Togo.
Réponds toujours en français, avec un langage simple, fiable et professionnel, en 3 à 4 phrases courtes maximum.
Priorise la sécurité. Pour un accident: sécuriser la zone, protéger les victimes, alerter les secours, fournir les renseignements utiles et ne pas déplacer un blessé sauf danger immédiat.
N'invente jamais une règle. Si une information réglementaire précise est incertaine, dis-le clairement.`;

function apiKey() {
  const value = process.env.DEEPINFRA_API_KEY;
  if (!value) throw new Error('DEEPINFRA_API_KEY is not configured');
  return value;
}

async function deepInfra(path: string, init: RequestInit) {
  const response = await fetch(`${DEEPINFRA_BASE}${path}`, {
    ...init,
    signal: AbortSignal.timeout(55000),
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      ...(init.headers || {}),
    },
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`DeepInfra ${response.status}: ${detail}`);
  }
  return response;
}

export async function createEmbeddings(inputs: string[]): Promise<number[][]> {
  const response = await deepInfra('/v1/openai/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: inputs, encoding_format: 'float' }),
  });
  const payload: any = await response.json();
  return (payload.data || []).sort((a: any, b: any) => a.index - b.index).map((item: any) => item.embedding);
}

export async function retrieveContext(question: string) {
  const [embedding] = await createEmbeddings([question]);
  if (!embedding) return [];
  const vector = `[${embedding.join(',')}]`;
  const result = await query<{ content: string; similarity: number }>(
    'SELECT content, similarity FROM match_ai_chunks($1::extensions.vector, $2, $3)',
    [vector, Number(process.env.AI_RAG_THRESHOLD || 0.45), Number(process.env.AI_RAG_TOP_K || 3)]
  );
  return result.rows;
}

export async function answerQuestion(question: string, history: ChatMessage[]) {
  let chunks: Array<{ content: string; similarity: number }> = [];
  try {
    chunks = await retrieveContext(question);
  } catch (error: any) {
    // Chat remains available while the RAG schema is being provisioned.
    console.warn('RAG retrieval unavailable:', error.message);
  }
  const context = chunks.length
    ? `\n\nCONTEXTE DOCUMENTAIRE PRIORITAIRE:\n${chunks.map((item) => item.content).join('\n\n---\n\n')}`
    : '';
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT + context },
    ...history.slice(-6).filter((item) => item?.content && ['user', 'assistant'].includes(item.role)),
    { role: 'user', content: question },
  ];
  const response = await deepInfra('/v1/openai/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: CHAT_MODEL, messages, temperature: 0.4, max_tokens: 350 }),
  });
  const payload: any = await response.json();
  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('DeepInfra returned an empty chat response');
  return { response: text, ragChunks: chunks.length };
}

export async function transcribeAudio(buffer: Buffer, filename: string, mimeType: string) {
  const form = new FormData();
  const bytes = Uint8Array.from(buffer);
  form.append('audio', new Blob([bytes], { type: mimeType }), filename);
  form.append('language', 'fr');
  const response = await deepInfra(`/v1/inference/${TRANSCRIPTION_MODEL}`, { method: 'POST', body: form });
  const payload: any = await response.json();
  const text = payload.text || payload.results?.[0]?.text;
  if (!text) throw new Error('No speech was detected');
  return text;
}

export async function synthesizeSpeech(text: string) {
  const response = await deepInfra(`/v1/inference/${TTS_MODEL}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, output_format: 'mp3', language_code: 'fr' }),
  });
  return { audio: Buffer.from(await response.arrayBuffer()), contentType: response.headers.get('content-type') || 'audio/mpeg' };
}

export const aiModels = { chat: CHAT_MODEL, embedding: EMBEDDING_MODEL, transcription: TRANSCRIPTION_MODEL, tts: TTS_MODEL };
