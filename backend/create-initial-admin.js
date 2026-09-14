const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
require('dotenv').config();

async function main() {
  const rawPhone = process.env.INITIAL_ADMIN_PHONE;
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  const compact = rawPhone.replace(/[\s().-]/g, '');
  const phone = /^\d{8}$/.test(compact) ? `+228${compact}` : compact.startsWith('228') && /^228\d{8}$/.test(compact) ? `+${compact}` : compact;
  if (!process.env.DATABASE_URL || !phone || !password || password.length < 12) {
    throw new Error('DATABASE_URL, INITIAL_ADMIN_PHONE et INITIAL_ADMIN_PASSWORD (12 caractères minimum) sont requis.');
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await pool.query('BEGIN');
    const existing = await pool.query('SELECT id FROM users WHERE phone=$1 OR phone=$2 LIMIT 1', [phone, rawPhone]);
    let userId = existing.rows[0]?.id;
    const hash = await bcrypt.hash(password, 12);
    if (!userId) {
      userId = crypto.randomUUID();
      await pool.query('INSERT INTO users(id,phone,password) VALUES($1,$2,$3)', [userId, phone, hash]);
    } else {
      await pool.query('UPDATE users SET phone=$1, password=$2 WHERE id=$3', [phone, hash, userId]);
      await pool.query('UPDATE users SET password=$1 WHERE phone=$2', [hash, rawPhone]);
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
