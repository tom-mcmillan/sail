import { Router } from 'express';
import { db } from '../services/database';

const router = Router();

// Migration endpoint for adding packet key support
// Migration endpoint for refactoring packet keys (separate ID and access key)
router.post('/migrate/refactor-packet-keys', async (req, res) => {
  try {
    console.log('🔄 Running migration: Refactor packet keys...');
    
    // Add new columns
    await db.query(`
      ALTER TABLE packet_keys 
      ADD COLUMN IF NOT EXISTS packet_id VARCHAR(100),
      ADD COLUMN IF NOT EXISTS access_key VARCHAR(30)
    `);
    
    // Update existing packet_keys to have proper packet_id and access_key
    await db.query(`
      UPDATE packet_keys 
      SET 
        packet_id = CASE 
          WHEN name IS NOT NULL THEN 
            lower(regexp_replace(regexp_replace(name, '[^a-zA-Z0-9\\s-]', '', 'g'), '\\s+', '-', 'g')) || '-' || substring(md5(random()::text), 1, 8)
          ELSE 
            'packet-' || substring(md5(random()::text), 1, 12)
        END,
        access_key = 'sail-pk-' || lower(substring(md5(random()::text), 1, 12))
      WHERE packet_id IS NULL OR access_key IS NULL
    `);
    
    // Make columns NOT NULL
    await db.query(`
      ALTER TABLE packet_keys 
      ALTER COLUMN packet_id SET NOT NULL,
      ALTER COLUMN access_key SET NOT NULL
    `);
    
    // Add unique constraints
    await db.query(`
      ALTER TABLE packet_keys 
      ADD CONSTRAINT IF NOT EXISTS unique_packet_id UNIQUE (packet_id),
      ADD CONSTRAINT IF NOT EXISTS unique_access_key UNIQUE (access_key)
    `);
    
    // Add access_key column to usage table
    await db.query(`
      ALTER TABLE packet_key_usage 
      ADD COLUMN IF NOT EXISTS access_key VARCHAR(30)
    `);
    
    // Update function
    await db.query(`
      CREATE OR REPLACE FUNCTION generate_packet_identifiers(packet_name TEXT DEFAULT NULL) 
      RETURNS TABLE(packet_id VARCHAR, access_key VARCHAR) AS $$
      DECLARE
        new_packet_id VARCHAR;
        new_access_key VARCHAR;
        id_exists BOOLEAN;
        key_exists BOOLEAN;
      BEGIN
        -- Generate packet_id
        LOOP
          IF packet_name IS NOT NULL THEN
            new_packet_id := lower(regexp_replace(regexp_replace(packet_name, '[^a-zA-Z0-9\\s-]', '', 'g'), '\\s+', '-', 'g')) || '-' || lower(substring(md5(random()::text), 1, 8));
          ELSE
            new_packet_id := 'packet-' || lower(substring(md5(random()::text), 1, 12));
          END IF;
          
          SELECT EXISTS(SELECT 1 FROM packet_keys WHERE packet_keys.packet_id = new_packet_id) INTO id_exists;
          EXIT WHEN NOT id_exists;
        END LOOP;
        
        -- Generate access_key
        LOOP
          new_access_key := 'sail-pk-' || lower(substring(md5(random()::text), 1, 12));
          SELECT EXISTS(SELECT 1 FROM packet_keys WHERE packet_keys.access_key = new_access_key) INTO key_exists;
          EXIT WHEN NOT key_exists;
        END LOOP;
        
        RETURN QUERY SELECT new_packet_id, new_access_key;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    console.log('✅ Packet key refactor completed!');
    
    res.json({
      success: true,
      message: 'Packet key refactor completed successfully',
      changes: [
        'Added packet_id and access_key columns',
        'Updated existing records with new identifiers',
        'Added unique constraints',
        'Updated packet_key_usage table',
        'Created generate_packet_identifiers() function'
      ]
    });
    
  } catch (error: any) {
    console.error('❌ Packet key refactor failed:', error.message);
    res.status(500).json({
      success: false,
      error: `Packet key refactor failed: ${error.message}`
    });
  }
});

router.post('/migrate/add-packet-keys', async (req, res) => {
  try {
    console.log('🔄 Running migration: Add packet key support...');
    
    // Create oauth_tokens table
    await db.query(`
      CREATE TABLE IF NOT EXISTS oauth_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        service VARCHAR(50) NOT NULL CHECK (service IN ('github', 'google_drive', 'notion', 'slack')),
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        expires_at TIMESTAMP WITH TIME ZONE,
        scope TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id, service)
      )
    `);
    
    // Create packet_keys table
    await db.query(`
      CREATE TABLE IF NOT EXISTS packet_keys (
        key VARCHAR(20) PRIMARY KEY,
        exchange_id UUID NOT NULL REFERENCES exchanges(id) ON DELETE CASCADE,
        creator_id UUID NOT NULL REFERENCES users(id),
        name VARCHAR(255),
        description TEXT,
        permissions JSONB DEFAULT '{"read": true, "write": false}',
        usage_count INTEGER DEFAULT 0,
        max_usage INTEGER,
        expires_at TIMESTAMP WITH TIME ZONE,
        last_used_at TIMESTAMP WITH TIME ZONE,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    
    // Create packet_key_usage table
    await db.query(`
      CREATE TABLE IF NOT EXISTS packet_key_usage (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        packet_key VARCHAR(20) NOT NULL REFERENCES packet_keys(key) ON DELETE CASCADE,
        client_info JSONB,
        method VARCHAR(100),
        resource_accessed TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    
    // Create indexes
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user_service ON oauth_tokens(user_id, service);
      CREATE INDEX IF NOT EXISTS idx_packet_keys_exchange ON packet_keys(exchange_id);
      CREATE INDEX IF NOT EXISTS idx_packet_keys_creator ON packet_keys(creator_id);
      CREATE INDEX IF NOT EXISTS idx_packet_keys_active ON packet_keys(is_active);
      CREATE INDEX IF NOT EXISTS idx_packet_key_usage_key ON packet_key_usage(packet_key);
      CREATE INDEX IF NOT EXISTS idx_packet_key_usage_created ON packet_key_usage(created_at);
    `);
    
    // Create packet key generation function
    await db.query(`
      CREATE OR REPLACE FUNCTION generate_packet_key() RETURNS VARCHAR AS $$
      DECLARE
        new_key VARCHAR;
        key_exists BOOLEAN;
      BEGIN
        LOOP
          new_key := 'sail-pk-' || lower(substring(md5(random()::text), 1, 8));
          SELECT EXISTS(SELECT 1 FROM packet_keys WHERE key = new_key) INTO key_exists;
          EXIT WHEN NOT key_exists;
        END LOOP;
        RETURN new_key;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    // Create usage tracking trigger
    await db.query(`
      CREATE OR REPLACE FUNCTION update_packet_key_usage() RETURNS TRIGGER AS $$
      BEGIN
        UPDATE packet_keys 
        SET 
          usage_count = usage_count + 1,
          last_used_at = NOW()
        WHERE key = NEW.packet_key;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    await db.query(`
      DROP TRIGGER IF EXISTS update_packet_key_usage_trigger ON packet_key_usage;
      CREATE TRIGGER update_packet_key_usage_trigger
      AFTER INSERT ON packet_key_usage
      FOR EACH ROW EXECUTE FUNCTION update_packet_key_usage();
    `);
    
    console.log('✅ Packet key migration completed successfully!');
    
    res.json({
      success: true,
      message: 'Packet key migration completed successfully',
      changes: [
        'Created oauth_tokens table for credential storage',
        'Created packet_keys table for key management',
        'Created packet_key_usage table for analytics',
        'Added generate_packet_key() function',
        'Added usage tracking trigger',
        'Created performance indexes'
      ]
    });
    
  } catch (error: any) {
    console.error('❌ Packet key migration failed:', error.message);
    res.status(500).json({
      success: false,
      error: `Packet key migration failed: ${error.message}`
    });
  }
});

// Migration endpoint for adding composite type support
router.post('/migrate/add-composite-type', async (req, res) => {
  try {
    console.log('🔄 Running migration: Add composite type support...');
    
    // Add composite to the type constraint
    await db.query(`
      ALTER TABLE exchanges 
      DROP CONSTRAINT IF EXISTS exchanges_type_check
    `);
    
    await db.query(`
      ALTER TABLE exchanges 
      ADD CONSTRAINT exchanges_type_check 
      CHECK (type IN ('local', 'github', 'google-drive', 'zotero', 'composite'))
    `);
    
    // Add composite to the knowledge_type constraint  
    await db.query(`
      ALTER TABLE exchanges 
      DROP CONSTRAINT IF EXISTS exchanges_knowledge_type_check
    `);
    
    await db.query(`
      ALTER TABLE exchanges 
      ADD CONSTRAINT exchanges_knowledge_type_check 
      CHECK (knowledge_type IN ('local', 'github', 'google-drive', 'zotero', 'composite'))
    `);
    
    // Add expires_at column if it doesn't exist
    await db.query(`
      ALTER TABLE exchanges 
      ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE
    `);
    
    console.log('✅ Migration completed successfully!');
    
    res.json({
      success: true,
      message: 'Migration completed successfully',
      changes: [
        'Added "composite" to type constraint',
        'Added "composite" to knowledge_type constraint', 
        'Added expires_at column'
      ]
    });
    
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    res.status(500).json({
      success: false,
      error: `Migration failed: ${error.message}`
    });
  }
});

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ 
      success: true, 
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      database: 'error',
      error: error.message 
    });
  }
});

export default router;