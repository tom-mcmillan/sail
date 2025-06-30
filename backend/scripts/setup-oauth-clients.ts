import { db } from '../src/services/database';

async function setupOAuthClients() {
  try {
    console.log('Setting up OAuth clients...');
    
    // Create Claude AI client
    await db.query(`
      INSERT INTO oauth_clients (id, name, redirect_uris, scopes, is_public, pkce_required)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name,
          redirect_uris = EXCLUDED.redirect_uris,
          scopes = EXCLUDED.scopes
    `, [
      'claudeai',
      'Claude AI',
      JSON.stringify([
        'https://claude.ai/auth/callback',
        'https://claude.ai/integrations/callback',
        'https://claude.ai/oauth/callback'
      ]),
      ['mcp:read', 'mcp:write'],
      true,  // public client
      false  // no PKCE required
    ]);
    
    // Create ChatGPT client
    await db.query(`
      INSERT INTO oauth_clients (id, name, redirect_uris, scopes, is_public, pkce_required)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name,
          redirect_uris = EXCLUDED.redirect_uris,
          scopes = EXCLUDED.scopes
    `, [
      'chatgpt',
      'ChatGPT',
      JSON.stringify([
        'https://chat.openai.com/aip/oauth/callback',
        'https://chat.openai.com/auth/callback',
        'https://chat.openai.com/oauth/callback'
      ]),
      ['mcp:read', 'mcp:write'],
      true,  // public client
      false  // no PKCE required
    ]);
    
    console.log('✅ OAuth clients created successfully');
    
    // List all clients
    const result = await db.query('SELECT id, name FROM oauth_clients');
    console.log('\nRegistered OAuth clients:');
    result.rows.forEach(client => {
      console.log(`- ${client.id}: ${client.name}`);
    });
    
  } catch (error) {
    console.error('❌ Error setting up OAuth clients:', error);
    throw error;
  } finally {
    await db.close();
  }
}

// Run the setup
setupOAuthClients().catch(console.error);