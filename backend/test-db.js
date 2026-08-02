const { Pool } = require('pg');

const testUrl = process.env.TEST_DB_URL;

if (!testUrl) {
  console.log("Please provide TEST_DB_URL environment variable.");
  process.exit(1);
}

console.log("Testing connection to:", testUrl.replace(/:[^:@]+@/, ':***@'));

const pool = new Pool({
  connectionString: testUrl,
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error("Connection failed:", err.message);
  } else {
    console.log("Connection successful! Server time:", res.rows[0].now);
  }
  pool.end();
});
