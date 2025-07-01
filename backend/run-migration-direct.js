const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration for Cloud SQL
const client = new Client({
  host: '34.135.247.25', // Cloud SQL public IP
  port: 5432,
  database: 'sail_prod',
  user: 'sail_user',
  password: 'SuperSecure123Password456',
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  try {
    console.log('🔄 Connecting to database...');
    await client.connect();
    
    console.log('📖 Reading migration file...');
    const migrationPath = path.join(__dirname, 'migrations', '005_refactor_packet_keys.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('🚀 Running migration: Refactor packet keys...');
    await client.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    
    // Test the new function
    console.log('🧪 Testing packet identifier generation...');
    const result = await client.query('SELECT * FROM generate_packet_identifiers($1)', ['Test Packet']);
    console.log('Generated identifiers:', result.rows[0]);
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();