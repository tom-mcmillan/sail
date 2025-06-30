import { Router, Request, Response } from 'express';
import { db } from '../services/database';
import crypto from 'crypto';

const router = Router();

interface ConsentRequest extends Request {
  user?: any;
  query: {
    client_id: string;
    redirect_uri: string;
    response_type: string;
    scope: string;
    state?: string;
    code_challenge?: string;
    code_challenge_method?: string;
  };
}

// Show consent screen
router.get('/consent', async (req: ConsentRequest, res: Response) => {
  try {
    const { client_id, redirect_uri, scope, state } = req.query;

    // Get client info
    console.log('Looking up OAuth client:', client_id);
    const clientResult = await db.query(
      'SELECT * FROM oauth_clients WHERE id = $1',
      [client_id]
    );
    console.log('OAuth client query result:', clientResult.rows.length, 'rows');

    if (clientResult.rows.length === 0) {
      return res.status(400).send('Invalid client');
    }

  const client = clientResult.rows[0];
  const scopes = scope?.split(' ') || ['mcp:read'];

  // In production, render a proper HTML consent page
  // For now, return a simple form
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Authorize ${client.name}</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
        .consent-box { border: 1px solid #ddd; padding: 20px; border-radius: 8px; }
        .scopes { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 4px; }
        button { padding: 10px 20px; margin: 10px 5px; border: none; border-radius: 4px; cursor: pointer; }
        .approve { background: #4CAF50; color: white; }
        .deny { background: #f44336; color: white; }
      </style>
    </head>
    <body>
      <div class="consent-box">
        <h2>${client.name} wants to access your Sail MCP account</h2>
        <p>This will allow ${client.name} to:</p>
        <div class="scopes">
          ${scopes.includes('mcp:read') ? '<li>Read your MCP exchanges</li>' : ''}
          ${scopes.includes('mcp:write') ? '<li>Modify your MCP exchanges</li>' : ''}
        </div>
        <form method="POST" action="/oauth/consent" target="_top">
          <input type="hidden" name="client_id" value="${client_id}">
          <input type="hidden" name="redirect_uri" value="${redirect_uri}">
          <input type="hidden" name="scope" value="${scope}">
          <input type="hidden" name="state" value="${state || ''}">
          <input type="hidden" name="code_challenge" value="${req.query.code_challenge || ''}">
          <input type="hidden" name="code_challenge_method" value="${req.query.code_challenge_method || ''}">
          <button type="submit" name="decision" value="approve" class="approve" onclick="this.form.target='_top'">Approve</button>
          <button type="submit" name="decision" value="deny" class="deny">Deny</button>
        </form>
        
        <script>
          // Ensure redirects work in the top window (in case this is in an iframe)
          if (window.top !== window.self) {
            document.addEventListener('DOMContentLoaded', function() {
              const form = document.querySelector('form');
              if (form) {
                form.target = '_top';
              }
            });
          }
        </script>
      </div>
    </body>
    </html>
  `);
  } catch (error) {
    console.error('OAuth consent error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Handle consent decision
router.post('/consent', async (req: Request, res: Response) => {
  try {
    console.log('OAuth consent POST headers:', JSON.stringify(req.headers, null, 2));
    console.log('OAuth consent POST body:', req.body);
    
    const { 
      decision, 
      client_id, 
      redirect_uri, 
      scope, 
      state,
      code_challenge,
      code_challenge_method 
    } = req.body;

  if (decision !== 'approve') {
    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set('error', 'access_denied');
    if (state) redirectUrl.searchParams.set('state', state);
    return res.redirect(redirectUrl.toString());
  }

  // Generate authorization code
  const authCode = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Store authorization code with user context
  await db.query(`
    INSERT INTO oauth_authorization_codes (
      code, client_id, redirect_uri, scopes, 
      code_challenge, code_challenge_method, 
      expires_at, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
  `, [
    authCode,
    client_id,
    redirect_uri,
    scope.split(' '),
    code_challenge,
    code_challenge_method,
    expiresAt
  ]);

  // Redirect with authorization code
  const redirectUrl = new URL(redirect_uri);
  redirectUrl.searchParams.set('code', authCode);
  if (state) redirectUrl.searchParams.set('state', state);
  
  console.log('Generated redirect URL:', redirectUrl.toString());
  
  // Check if this is an AJAX request (Claude might be using fetch/XHR)
  const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest' || 
                 req.headers['accept']?.includes('application/json');
  
  console.log('Is AJAX request?', isAjax);
  console.log('Accept header:', req.headers['accept']);
  
  if (isAjax) {
    // Respond with JSON for AJAX requests
    console.log('Sending JSON response');
    res.json({
      success: true,
      redirect_uri: redirectUrl.toString(),
      code: authCode,
      state: state
    });
  } else {
    // For form submissions, use JavaScript redirect instead of HTTP redirect
    console.log('Sending JavaScript redirect to:', redirectUrl.toString());
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Redirecting...</title>
      </head>
      <body>
        <p>Redirecting to Claude.ai...</p>
        <p><strong>Manual Link:</strong> <a href="${redirectUrl.toString()}" target="_top" style="color: blue; text-decoration: underline; font-size: 18px;">Click here to complete authorization</a></p>
        
        <script>
          console.log('Attempting redirect to: ${redirectUrl.toString()}');
          console.log('Page loaded, executing redirect...');
          
          // Try immediate redirect first
          try {
            console.log('Window context:', window.top === window.self ? 'main window' : 'iframe');
            
            // Small delay to ensure page is loaded
            setTimeout(function() {
              console.log('Attempting redirect now...');
              if (window.top !== window.self) {
                console.log('Redirecting top window...');
                window.top.location.href = "${redirectUrl.toString()}";
              } else {
                console.log('Redirecting current window...');
                window.location.href = "${redirectUrl.toString()}";
              }
            }, 1000);
            
          } catch (e) {
            console.error('Redirect failed:', e);
            document.body.innerHTML += '<p style="color: red;">Automatic redirect failed: ' + e.message + '</p>';
          }
        </script>
      </body>
      </html>
    `);
  }
  } catch (error) {
    console.error('OAuth consent POST error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;