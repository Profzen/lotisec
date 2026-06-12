const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    console.log("Checking columns for accident_events...");
    const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'accident_events'
    `;
    const checkRes = await pool.query(checkQuery);
    const columns = checkRes.rows.map(r => r.column_name);

    const queries = [];

    if (!columns.includes('hour_of_day')) queries.push('ALTER TABLE accident_events ADD COLUMN hour_of_day INT');
    if (!columns.includes('day_of_week')) queries.push('ALTER TABLE accident_events ADD COLUMN day_of_week INT');
    if (!columns.includes('vehicle_type')) queries.push('ALTER TABLE accident_events ADD COLUMN vehicle_type VARCHAR(50)');
    if (!columns.includes('weather')) queries.push('ALTER TABLE accident_events ADD COLUMN weather VARCHAR(50)');
    if (!columns.includes('severity')) queries.push('ALTER TABLE accident_events ADD COLUMN severity VARCHAR(50)');
    if (!columns.includes('is_hotspot')) queries.push('ALTER TABLE accident_events ADD COLUMN is_hotspot BOOLEAN DEFAULT false');
    if (!columns.includes('resolved')) queries.push('ALTER TABLE accident_events ADD COLUMN resolved BOOLEAN DEFAULT false');
    if (!columns.includes('cause_probable')) queries.push('ALTER TABLE accident_events ADD COLUMN cause_probable TEXT');
    if (!columns.includes('road_type')) queries.push('ALTER TABLE accident_events ADD COLUMN road_type VARCHAR(50)');
    if (!columns.includes('resolved_at')) queries.push('ALTER TABLE accident_events ADD COLUMN resolved_at TIMESTAMP');

    for (let q of queries) {
      console.log(`Executing: ${q}`);
      await pool.query(q);
    }

    console.log("Migration des colonnes de accident_events terminée avec succès !");
  } catch (error) {
    console.error("Erreur lors de la migration :", error.message);
  } finally {
    await pool.end();
  }
}

main();
