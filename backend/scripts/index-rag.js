require('dotenv').config();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');
const { Pool } = require('pg');

const model = process.env.AI_EMBEDDING_MODEL || 'BAAI/bge-m3';

function chunks(text, size = 380, overlap = 60) {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const result = [];
  for (let start = 0; start < words.length; start += size - overlap) {
    const content = words.slice(start, start + size).join(' ').trim();
    if (content.length >= 80) result.push(content);
  }
  return result;
}

async function embed(inputs) {
  const response = await fetch('https://api.deepinfra.com/v1/openai/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.DEEPINFRA_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: inputs, encoding_format: 'float' }),
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) throw new Error(`Embedding failed (${response.status}): ${(await response.text()).slice(0, 400)}`);
  const payload = await response.json();
  return payload.data.sort((a, b) => a.index - b.index).map((item) => item.embedding);
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  if (!process.env.DEEPINFRA_API_KEY) throw new Error('DEEPINFRA_API_KEY is required');
  const pdfPath = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', 'default_code.pdf'));
  const buffer = fs.readFileSync(pdfPath);
  const parser = new PDFParse({ data: buffer });
  const extracted = await parser.getText();
  await parser.destroy();
  const items = chunks(extracted.text);
  if (!items.length) throw new Error('No usable text extracted from PDF');

  const vectors = [];
  for (let offset = 0; offset < items.length; offset += 16) {
    vectors.push(...await embed(items.slice(offset, offset + 16)));
    console.log(`Embeddings: ${Math.min(offset + 16, items.length)}/${items.length}`);
  }
  if (vectors.some((vector) => vector.length !== 1024)) throw new Error('Embedding model must return 1024 dimensions');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
    const sourceKey = path.basename(pdfPath);
    const document = await client.query(
      `INSERT INTO ai_documents(source_key,title,checksum,embedding_model,chunk_count)
       VALUES($1,$2,$3,$4,$5)
       ON CONFLICT(source_key) DO UPDATE SET title=EXCLUDED.title, checksum=EXCLUDED.checksum,
         embedding_model=EXCLUDED.embedding_model, chunk_count=EXCLUDED.chunk_count, active=true, updated_at=now()
       RETURNING id`,
      [sourceKey, sourceKey.replace(/\.pdf$/i, ''), checksum, model, items.length]
    );
    await client.query('DELETE FROM ai_document_chunks WHERE document_id=$1', [document.rows[0].id]);
    for (let index = 0; index < items.length; index += 1) {
      await client.query(
        `INSERT INTO ai_document_chunks(document_id,chunk_index,content,embedding,metadata)
         VALUES($1,$2,$3,$4::extensions.vector,$5::jsonb)`,
        [document.rows[0].id, index, items[index], `[${vectors[index].join(',')}]`, JSON.stringify({ source: sourceKey })]
      );
    }
    await client.query('COMMIT');
    console.log(`RAG ready: ${items.length} chunks indexed from ${sourceKey}.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
