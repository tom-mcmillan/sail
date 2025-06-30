import { Request, Response } from 'express';
import { db } from '../database';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

interface OAuthClient {
  id: string;
  secret?: string;
  name: string;
  redirectUris: string[];
  scopes: string[];
  isPublic: boolean;
  pkceRequired: boolean;
  createdAt: Date;
}

interface AuthorizationCode {
  code: string;
  clientId: string;
  userId?: string;
  redirectUri: string;
  scopes: string[];
  codeChallenge?: string;
  codeChallengeMethod?: string;
  expiresAt: Date;
}

interface AccessToken {
  token: string;
  clientId: string;
  userId?: string;
  scopes: string[];
  expiresAt: Date;
}

export class OAuthAuthorizationServer {
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'default-secret';
  private readonly baseUrl = process.env.BASE_URL || 'https://sailmcp.com';

  /**
   * OAuth Authorization Server Metadata (RFC 8414)
   */
  async getAuthorizationServerMetadata(req: Request, res: Response): Promise<void> {
    const metadata = {
      issuer: this.baseUrl,
      authorization_endpoint: `${this.baseUrl}/oauth/authorize`,
      token_endpoint: `${this.baseUrl}/oauth/token`,
      registration_endpoint: `${this.baseUrl}/oauth/register`,
      scopes_supported: ['mcp:read', 'mcp:write'],
      response_types_supported: ['code'],
      response_modes_supported: ['query'],
      grant_types_supported: ['authorization_code'],
      token_endpoint_auth_methods_supported: ['none', 'client_secret_basic', 'client_secret_post'],
      code_challenge_methods_supported: ['S256'],
      introspection_endpoint: `${this.baseUrl}/oauth/introspect`,
      revocation_endpoint: `${this.baseUrl}/oauth/revoke`
    };

    res.json(metadata);
  }

  /**
   * OAuth Protected Resource Metadata (for MCP compliance)
   */
  async getProtectedResourceMetadata(req: Request, res: Response): Promise<void> {
    const metadata = {
      resource: this.baseUrl,
      authorization_servers: [this.baseUrl],
      scopes_supported: ['mcp:read', 'mcp:write'],
      bearer_methods_supported: ['header'],
      resource_documentation: `${this.baseUrl}/docs`
    };

    res.json(metadata);
  }

  /**
   * Dynamic Client Registration (RFC 7591)
   */
  async registerClient(req: Request, res: Response): Promise<void> {
    try {
      const {
        client_name,
        redirect_uris = [],
        scope = 'mcp:read',
        token_endpoint_auth_method = 'none'
      } = req.body;

      if (!client_name) {
        res.status(400).json({
          error: 'invalid_client_metadata',
          error_description: 'client_name is required'
        });
        return;
      }

      const clientId = `mcp_${crypto.randomBytes(16).toString('hex')}`;
      const isPublic = token_endpoint_auth_method === 'none';
      const clientSecret = isPublic ? undefined : crypto.randomBytes(32).toString('hex');

      // Store client in database
      await db.query(`
        INSERT INTO oauth_clients (
          id, secret, name, redirect_uris, scopes, is_public, pkce_required, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        clientId,
        clientSecret,
        client_name,
        JSON.stringify(redirect_uris),
        scope.split(' '),
        isPublic,
        isPublic // Require PKCE for public clients
      ]);

      const response: any = {
        client_id: clientId,
        client_name,
        redirect_uris,
        scope,
        token_endpoint_auth_method,
        grant_types: ['authorization_code'],
        response_types: ['code']
      };

      if (!isPublic && clientSecret) {
        response.client_secret = clientSecret;
      }

      res.status(201).json(response);
    } catch (error) {
      console.error('Client registration error:', error);
      res.status(500).json({
        error: 'server_error',
        error_description: 'Failed to register client'
      });
    }
  }

  /**
   * Authorization Endpoint (RFC 6749)
   */
  async authorize(req: Request, res: Response): Promise<void> {
    try {
      const {
        client_id,
        redirect_uri,
        response_type,
        scope = 'mcp:read',
        state,
        code_challenge,
        code_challenge_method
      } = req.query;

      // Validate parameters
      if (response_type !== 'code') {
        return this.sendAuthorizationError(res, redirect_uri as string, 'unsupported_response_type', state as string);
      }

      if (!client_id) {
        return this.sendAuthorizationError(res, redirect_uri as string, 'invalid_request', state as string, 'client_id is required');
      }

      // Verify client exists
      const clientResult = await db.query(
        'SELECT * FROM oauth_clients WHERE id = $1',
        [client_id]
      );

      if (clientResult.rows.length === 0) {
        return this.sendAuthorizationError(res, redirect_uri as string, 'invalid_client', state as string);
      }

      const client = clientResult.rows[0];

      // Validate redirect URI
      const allowedUris = JSON.parse(client.redirect_uris);
      if (redirect_uri && !allowedUris.includes(redirect_uri)) {
        return this.sendAuthorizationError(res, undefined, 'invalid_request', state as string, 'Invalid redirect_uri');
      }

      // Check PKCE for public clients
      if (client.is_public && client.pkce_required && !code_challenge) {
        return this.sendAuthorizationError(res, redirect_uri as string, 'invalid_request', state as string, 'PKCE required for public clients');
      }

      // Redirect to consent screen for user authorization
      const consentUrl = new URL(`${this.baseUrl}/oauth/consent`);
      consentUrl.searchParams.set('client_id', client_id as string);
      consentUrl.searchParams.set('redirect_uri', redirect_uri as string || allowedUris[0]);
      consentUrl.searchParams.set('response_type', 'code');
      consentUrl.searchParams.set('scope', scope as string);
      if (state) consentUrl.searchParams.set('state', state as string);
      if (code_challenge) consentUrl.searchParams.set('code_challenge', code_challenge as string);
      if (code_challenge_method) consentUrl.searchParams.set('code_challenge_method', code_challenge_method as string);

      res.redirect(consentUrl.toString());
    } catch (error) {
      console.error('Authorization error:', error);
      res.status(500).json({
        error: 'server_error',
        error_description: 'Authorization failed'
      });
    }
  }

  /**
   * Token Endpoint (RFC 6749)
   */
  async token(req: Request, res: Response): Promise<void> {
    try {
      const {
        grant_type,
        code,
        client_id,
        client_secret,
        redirect_uri,
        code_verifier
      } = req.body;

      if (grant_type !== 'authorization_code') {
        res.status(400).json({
          error: 'unsupported_grant_type',
          error_description: 'Only authorization_code grant type is supported'
        });
        return;
      }

      if (!code || !client_id) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'code and client_id are required'
        });
        return;
      }

      // Get authorization code
      const codeResult = await db.query(
        'SELECT * FROM oauth_authorization_codes WHERE code = $1 AND client_id = $2',
        [code, client_id]
      );

      if (codeResult.rows.length === 0) {
        res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Invalid authorization code'
        });
        return;
      }

      const authCode = codeResult.rows[0];

      // Check if code is expired
      if (new Date() > new Date(authCode.expires_at)) {
        res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Authorization code expired'
        });
        return;
      }

      // Verify client
      const clientResult = await db.query(
        'SELECT * FROM oauth_clients WHERE id = $1',
        [client_id]
      );

      if (clientResult.rows.length === 0) {
        res.status(401).json({
          error: 'invalid_client',
          error_description: 'Invalid client credentials'
        });
        return;
      }

      const client = clientResult.rows[0];

      // Verify client secret for confidential clients
      if (!client.is_public && client.secret !== client_secret) {
        res.status(401).json({
          error: 'invalid_client',
          error_description: 'Invalid client credentials'
        });
        return;
      }

      // Verify PKCE for public clients
      if (client.is_public && authCode.code_challenge) {
        if (!code_verifier) {
          res.status(400).json({
            error: 'invalid_request',
            error_description: 'code_verifier required'
          });
          return;
        }

        const computedChallenge = crypto
          .createHash('sha256')
          .update(code_verifier)
          .digest('base64url');

        if (computedChallenge !== authCode.code_challenge) {
          res.status(400).json({
            error: 'invalid_grant',
            error_description: 'Invalid code_verifier'
          });
          return;
        }
      }

      // Generate access token
      const accessToken = jwt.sign(
        {
          client_id,
          scopes: authCode.scopes,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour
        },
        this.JWT_SECRET
      );

      // Store access token
      const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour
      await db.query(`
        INSERT INTO oauth_access_tokens (
          token, client_id, scopes, expires_at, created_at
        ) VALUES ($1, $2, $3, $4, NOW())
      `, [
        accessToken,
        client_id,
        authCode.scopes,
        expiresAt
      ]);

      // Delete used authorization code
      await db.query('DELETE FROM oauth_authorization_codes WHERE code = $1', [code]);

      res.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 3600,
        scope: authCode.scopes.join(' ')
      });
    } catch (error) {
      console.error('Token error:', error);
      res.status(500).json({
        error: 'server_error',
        error_description: 'Token generation failed'
      });
    }
  }

  /**
   * Token introspection (RFC 7662)
   */
  async introspect(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.body;

      if (!token) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'token parameter is required'
        });
        return;
      }

      try {
        const decoded = jwt.verify(token, this.JWT_SECRET) as any;
        
        // Check if token exists in database
        const tokenResult = await db.query(
          'SELECT * FROM oauth_access_tokens WHERE token = $1',
          [token]
        );

        if (tokenResult.rows.length === 0 || new Date() > new Date(tokenResult.rows[0].expires_at)) {
          res.json({ active: false });
          return;
        }

        res.json({
          active: true,
          client_id: decoded.client_id,
          scope: decoded.scopes.join(' '),
          exp: decoded.exp,
          iat: decoded.iat
        });
      } catch (jwtError) {
        res.json({ active: false });
      }
    } catch (error) {
      console.error('Introspection error:', error);
      res.status(500).json({
        error: 'server_error',
        error_description: 'Introspection failed'
      });
    }
  }

  private sendAuthorizationError(res: Response, redirectUri?: string, error?: string, state?: string, errorDescription?: string): void {
    if (redirectUri) {
      const url = new URL(redirectUri);
      url.searchParams.set('error', error || 'server_error');
      if (errorDescription) {
        url.searchParams.set('error_description', errorDescription);
      }
      if (state) {
        url.searchParams.set('state', state);
      }
      res.redirect(url.toString());
    } else {
      res.status(400).json({
        error: error || 'server_error',
        error_description: errorDescription || 'Authorization failed'
      });
    }
  }
}

export const oauthServer = new OAuthAuthorizationServer();