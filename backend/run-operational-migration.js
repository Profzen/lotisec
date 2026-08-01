const { Pool } = require('pg');
const { readFile } = require('fs/promises');
const path = require('path');
require('dotenv').config();

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL manquante');
  const sql = await readFile(path.join(__dirname, 'migrations', '20260731_operational_platform.sql'), 'utf8');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await pool.query('BEGIN');
    await pool.query(sql);
    await pool.query('COMMIT');
    console.log('Migration opérationnelle LOTISEC appliquée avec succès.');
  } catch (error) { await pool.query('ROLLBACK'); throw error; }
  finally { await pool.end(); }
}

main().catch((error) => { console.error(error.message); process.exit(1); });
