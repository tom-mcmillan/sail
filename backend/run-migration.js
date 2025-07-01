#!/usr/bin/env node

const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const runMigration = async () => {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Running migration: Add composite type support...');
    
    // Add composite to the type constraint
    await client.query(`
      ALTER TABLE exchanges 
      DROP CONSTRAINT IF EXISTS exchanges_type_check
    `);
    
    await client.query(`
      ALTER TABLE exchanges 
      ADD CONSTRAINT exchanges_type_check 
      CHECK (type IN ('local', 'github', 'google-drive', 'zotero', 'composite'))
    `);
    
    // Add composite to the knowledge_type constraint  
    await client.query(`
      ALTER TABLE exchanges 
      DROP CONSTRAINT IF EXISTS exchanges_knowledge_type_check
    `);
    
    await client.query(`
      ALTER TABLE exchanges 
      ADD CONSTRAINT exchanges_knowledge_type_check 
      CHECK (knowledge_type IN ('local', 'github', 'google-drive', 'zotero', 'composite'))
    `);
    
    // Add expires_at column if it doesn't exist
    await client.query(`
      ALTER TABLE exchanges 
      ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE
    `);
    
    console.log('✅ Migration completed successfully!');
    console.log('   - Added "composite" to type constraint');
    console.log('   - Added "composite" to knowledge_type constraint');
    console.log('   - Added expires_at column');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
  }
};

// Run migration
runMigration()
  .then(() => {
    console.log('🎉 Database migration complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration error:', error);
    process.exit(1);
  });