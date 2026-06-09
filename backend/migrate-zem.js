const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    console.log("Migration Zem module started...");
    
    // 1. Update profiles table
    console.log("Adding is_zem to profiles...");
    await pool.query(`
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_zem BOOLEAN DEFAULT false;
    `);

    // 2. Create zem_locations table
    console.log("Creating zem_locations table...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS zem_locations (
          zem_id VARCHAR(255) PRIMARY KEY,
          latitude FLOAT NOT NULL,
          longitude FLOAT NOT NULL,
          is_online BOOLEAN DEFAULT false,
          location GEOGRAPHY(Point, 4326),
          updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 3. Create rides table
    console.log("Creating rides table...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rides (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          passenger_id VARCHAR(255),
          zem_id VARCHAR(255),
          origin_lat FLOAT,
          origin_lng FLOAT,
          dest_lat FLOAT,
          dest_lng FLOAT,
          distance_km FLOAT,
          price_fcfa INTEGER,
          status VARCHAR(50) DEFAULT 'requested',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 4. Enable Supabase Realtime
    console.log("Enabling Supabase Realtime for new tables...");
    try {
      await pool.query(`ALTER PUBLICATION supabase_realtime ADD TABLE zem_locations;`);
      await pool.query(`ALTER PUBLICATION supabase_realtime ADD TABLE rides;`);
      console.log("Realtime enabled.");
    } catch(err) {
      console.log("Note: Realtime publication step issue (it might already exist or need different setup):", err.message);
    }

    console.log("Migration Zem completed successfully!");

  } catch(e) {
    console.error("Migration Error:", e.message);
  } finally {
    process.exit(0);
  }
}

main();
