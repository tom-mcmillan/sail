import { Router } from 'express';
import { db } from '../services/database';

const router = Router();

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