import dotenv from 'dotenv';
import { Pool, QueryResult, QueryResultRow } from 'pg';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10000,
    })
  : null;

export { pool };

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: any[] = []
): Promise<QueryResult<T>> {
  if (!pool) {
    throw new Error('DATABASE_URL is missing. Set it in Vercel Project Settings > Environment Variables.');
  }
  return pool.query<T>(text, params);
}
