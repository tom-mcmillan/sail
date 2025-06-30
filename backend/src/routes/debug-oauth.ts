import express from 'express';
import { db } from '../services/database';

const router = express.Router();

// Temporary endpoint to add Claude's dynamic client ID
router.post('/add-claude-client', async (req, res) => {
  try {
    if (process.env.NODE_ENV !== 'production') {
      return res.status(403).json({ error: 'Production only' });
    }

    const clientId = 'mcp_7b4d15c4833e87c5cd0986b12a4b7205';
    
    // Insert the client ID Claude is actually using
    await db.query(`
      INSERT INTO oauth_clients (id, name, redirect_uris, scopes, is_public, pkce_required)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO UPDATE SET
        redirect_uris = EXCLUDED.redirect_uris,
        scopes = EXCLUDED.scopes
    `, [
      clientId,
      'Claude AI (Dynamic)',
      JSON.stringify(['https://claude.ai/api/mcp/auth_callback']),
      ['mcp:read', 'mcp:write'],
      true,
      true  // PKCE required for this one
    ]);

    // Check if it was inserted
    const result = await db.query('SELECT * FROM oauth_clients WHERE id = $1', [clientId]);
    
    res.json({
      success: true,
      message: 'Claude dynamic client added',
      client: result.rows[0]
    });
  } catch (error) {
    console.error('Error adding Claude client:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Debug endpoint to see what clients exist
router.get('/clients', async (req, res) => {
  try {
    const result = await db.query('SELECT id, name, redirect_uris FROM oauth_clients');
    res.json({ clients: result.rows });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;