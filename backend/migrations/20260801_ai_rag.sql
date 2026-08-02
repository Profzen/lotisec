CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS ai_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text NOT NULL UNIQUE,
  title text NOT NULL,
  checksum text NOT NULL,
  embedding_model text NOT NULL,
  chunk_count integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_document_chunks (
  id bigserial PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES ai_documents(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  embedding extensions.vector(1024) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS ai_document_chunks_document_idx
  ON ai_document_chunks(document_id, chunk_index);

CREATE TABLE IF NOT EXISTS ai_request_logs (
  id bigserial PRIMARY KEY,
  user_id text REFERENCES users(id),
  channel text NOT NULL DEFAULT 'unknown',
  operation text NOT NULL CHECK (operation IN ('chat','transcribe','tts')),
  rag_chunks integer NOT NULL DEFAULT 0,
  success boolean NOT NULL,
  latency_ms integer NOT NULL DEFAULT 0,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_request_logs_created_idx ON ai_request_logs(created_at DESC);

CREATE OR REPLACE FUNCTION match_ai_chunks(
  query_embedding extensions.vector(1024),
  match_threshold double precision DEFAULT 0.45,
  match_count integer DEFAULT 3
)
RETURNS TABLE (
  id bigint,
  document_id uuid,
  content text,
  metadata jsonb,
  similarity double precision
)
LANGUAGE sql STABLE
AS $$
  SELECT c.id, c.document_id, c.content, c.metadata,
         1 - (c.embedding <=> query_embedding) AS similarity
  FROM ai_document_chunks c
  JOIN ai_documents d ON d.id = c.document_id
  WHERE d.active = true
    AND 1 - (c.embedding <=> query_embedding) >= match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT LEAST(match_count, 10);
$$;
