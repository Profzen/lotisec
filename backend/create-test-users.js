require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function registerViaApi(phone, password) {
  try {
    const res = await fetch('https://lotisec-backend.vercel.app/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password })
    });
    const data = await res.json();
    if (res.ok) {
      console.log(`✅ Créé via API : ${phone}`);
      return data.user.id;
    } else {
      console.log(`⚠️ API a répondu : ${data.detail} pour ${phone}`);
      // Try to login to get ID if already exists
      const loginRes = await fetch('https://lotisec-backend.vercel.app/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
      });
      const loginData = await loginRes.json();
      return loginData.user?.id;
    }
  } catch (err) {
    console.error("Fetch error", err);
  }
}

async function main() {
  try {
    console.log('Création des comptes...');
    
    // 1. Passager
    const passagerId = await registerViaApi('+22899000001', 'password123');
    
    // 2. Zem
    const zemId = await registerViaApi('+22899000002', 'password123');

    console.log('Connexion à Supabase pour activer le profil Zem...');
    if (zemId) {
      await pool.query('UPDATE profiles SET is_zem = true WHERE user_id = $1', [zemId]);
      
      // Mettre le Zem en ligne au centre de Lomé
      await pool.query(`
        INSERT INTO zem_locations (zem_id, latitude, longitude, is_online, location, updated_at)
        VALUES ($1, 6.1319, 1.2228, true, ST_SetSRID(ST_MakePoint(1.2228, 6.1319), 4326), NOW())
        ON CONFLICT (zem_id) 
        DO UPDATE SET is_online = true, updated_at = NOW();
      `, [zemId]);
      
      console.log('✅ Le compte +22899000002 a été upgradé en ZEM et est ONLINE à Lomé !');
    }

  } catch (error) {
    console.error('Erreur:', error);
  } finally {
    await pool.end();
  }
}

main();
