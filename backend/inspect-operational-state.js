const { Pool } = require('pg');
require('dotenv').config();

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL manquante');
  const pool = new Pool({ connectionString:process.env.DATABASE_URL, ssl:{rejectUnauthorized:false} });
  try {
    const result = await pool.query(`SELECT
      (SELECT count(*) FROM users)::int users,
      (SELECT count(*) FROM user_roles)::int role_assignments,
      (SELECT count(*) FROM organizations)::int organizations,
      (SELECT count(*) FROM incidents)::int incidents,
      (SELECT count(*) FROM roles)::int roles,
      (SELECT count(*) FROM user_roles WHERE role_key='admin')::int administrators`);
    console.log(JSON.stringify(result.rows[0],null,2));
  } finally { await pool.end(); }
}

main().catch((error)=>{console.error(error.message);process.exit(1);});
