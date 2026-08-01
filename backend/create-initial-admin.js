const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
require('dotenv').config();

async function main() {
  const phone = process.env.INITIAL_ADMIN_PHONE;
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (!process.env.DATABASE_URL || !phone || !password || password.length < 12) {
    throw new Error('DATABASE_URL, INITIAL_ADMIN_PHONE et INITIAL_ADMIN_PASSWORD (12 caractères minimum) sont requis.');
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await pool.query('BEGIN');
    const existing = await pool.query('SELECT id FROM users WHERE phone=$1 LIMIT 1', [phone]);
    let userId = existing.rows[0]?.id;
    if (!userId) {
      userId = crypto.randomUUID();
      await pool.query('INSERT INTO users(id,phone,password) VALUES($1,$2,$3)', [userId, phone, await bcrypt.hash(password, 12)]);
    }
    const org = await pool.query(`INSERT INTO organizations(name,type,code) VALUES('Administration LOTISEC','lotisec','LOTISEC-HQ') ON CONFLICT(code) DO UPDATE SET active=true RETURNING id`);
    await pool.query(`INSERT INTO organization_members(organization_id,user_id,status) VALUES($1,$2,'active') ON CONFLICT(organization_id,user_id) DO UPDATE SET status='active'`, [org.rows[0].id,userId]);
    await pool.query(`INSERT INTO user_roles(user_id,role_key,organization_id,granted_by) SELECT $1,'admin',$2,$1 WHERE NOT EXISTS(SELECT 1 FROM user_roles WHERE user_id=$1 AND role_key='admin' AND organization_id=$2)`, [userId,org.rows[0].id]);
    await pool.query('COMMIT');
    console.log('Administrateur initial prêt.');
  } catch (error) { await pool.query('ROLLBACK'); throw error; }
  finally { await pool.end(); }
}

main().catch((error) => { console.error(error.message); process.exit(1); });
