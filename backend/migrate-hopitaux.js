const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    console.log("Adding columns to medical_facilities...");
    await pool.query(`
      ALTER TABLE medical_facilities
      ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'hopital',
      ADD COLUMN IF NOT EXISTS address VARCHAR(255) DEFAULT 'Adresse inconnue',
      ADD COLUMN IF NOT EXISTS urgences BOOLEAN DEFAULT false;
    `);
    console.log("Columns added successfully!");
    
    // Update existing rows with some dummy data for the demo
    await pool.query(`UPDATE medical_facilities SET address = 'Lomé, Togo', urgences = true WHERE type = 'hopital';`);
    console.log("Existing rows updated.");

  } catch(e) {
    console.error("Migration Error:", e.message);
  } finally {
    process.exit(0);
  }
}

main();
