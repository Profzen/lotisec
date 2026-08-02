import { Router } from 'express';
import multer from 'multer';
import { query } from '../database';
import { aiModels, answerQuestion, synthesizeSpeech, transcribeAudio } from '../services/ai';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });
const nodeAiEnabled = process.env.ENABLE_NODE_AI === 'true';

async function logRequest(operation: 'chat' | 'transcribe' | 'tts', started: number, success: boolean, ragChunks = 0, error?: string, channel = 'unknown') {
  try {
    await query(
      `INSERT INTO ai_request_logs(channel, operation, rag_chunks, success, latency_ms, error_code)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [channel, operation, ragChunks, success, Date.now() - started, error?.slice(0, 120) || null]
    );
  } catch {
    // Observability must never make the assistant unavailable.
  }
}

router.get('/health', async (_req, res) => {
  let chunks = 0;
  try {
    const result = await query<{ count: string }>('SELECT COUNT(*)::text AS count FROM ai_document_chunks');
    chunks = Number(result.rows[0]?.count || 0);
  } catch {}
  res.json({ ok: true, enabled: nodeAiEnabled, provider_configured: Boolean(process.env.DEEPINFRA_API_KEY), rag_ready: chunks > 0, chunks, models: aiModels });
});

router.use((_req, res, next) => {
  if (nodeAiEnabled) return next();
  return res.status(503).json({ detail: 'Assistant Node en veille; fournisseur Railway temporairement actif' });
});

router.post('/chat', async (req, res) => {
  const started = Date.now();
  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
  const channel = String(req.header('x-lotisec-channel') || 'unknown').slice(0, 30);
  if (!question || question.length > 2000) return res.status(400).json({ detail: 'Question invalide' });
  try {
    const result = await answerQuestion(question, Array.isArray(req.body.history) ? req.body.history : []);
    await logRequest('chat', started, true, result.ragChunks, undefined, channel);
    return res.json({ response: result.response, rag_used: result.ragChunks > 0, sources_count: result.ragChunks });
  } catch (error: any) {
    await logRequest('chat', started, false, 0, error.message, channel);
    return res.status(502).json({ detail: 'Assistant IA temporairement indisponible' });
  }
});

router.post('/transcribe', upload.single('file'), async (req, res) => {
  const started = Date.now();
  const channel = String(req.header('x-lotisec-channel') || 'unknown').slice(0, 30);
  if (!req.file) return res.status(400).json({ detail: 'Fichier audio manquant' });
  try {
    const text = await transcribeAudio(req.file.buffer, req.file.originalname, req.file.mimetype || 'audio/wav');
    await logRequest('transcribe', started, true, 0, undefined, channel);
    return res.json({ text });
  } catch (error: any) {
    await logRequest('transcribe', started, false, 0, error.message, channel);
    return res.status(502).json({ detail: 'Transcription temporairement indisponible' });
  }
});

router.post('/tts', async (req, res) => {
  const started = Date.now();
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  const channel = String(req.header('x-lotisec-channel') || 'unknown').slice(0, 30);
  if (!text || text.length > 1500) return res.status(400).json({ detail: 'Texte invalide' });
  try {
    const result = await synthesizeSpeech(text);
    await logRequest('tts', started, true, 0, undefined, channel);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(result.audio);
  } catch (error: any) {
    await logRequest('tts', started, false, 0, error.message, channel);
    return res.status(502).json({ detail: 'Synthèse vocale temporairement indisponible' });
  }
});

export default router;
