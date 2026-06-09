const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const res = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
  `);
  console.log(res.rows.map(r => r.table_name));
  
  try {
    const res2 = await pool.query('SELECT count(*) FROM medical_facilities');
    console.log("medical_facilities count:", res2.rows[0].count);
  } catch(e) {
    console.log("Error querying medical_facilities:", e.message);
  }
  process.exit(0);
}

main();
