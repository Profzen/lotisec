const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('la migration IA configure pgvector et une recherche RAG persistante', () => {
  const sql = fs.readFileSync(path.join(root, 'migrations', '20260801_ai_rag.sql'), 'utf8');
  assert.match(sql, /CREATE EXTENSION IF NOT EXISTS vector/i);
  assert.match(sql, /extensions\.vector\(1024\)/i);
  assert.match(sql, /FUNCTION match_ai_chunks/i);
  assert.match(sql, /ai_request_logs/i);
});

test('les routes IA unifiées exposent chat, transcription, voix et santé', () => {
  const source = fs.readFileSync(path.join(root, 'src', 'routers', 'ai.ts'), 'utf8');
  for (const route of ['/health', '/chat', '/transcribe', '/tts']) assert.ok(source.includes(`'${route}'`));
});
