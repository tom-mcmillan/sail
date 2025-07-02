import express, { Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * Knowledge Packet MCP Server using official SDK
 * Implements SSE transport pattern for Claude AI compatibility
 */

interface KnowledgePacket {
  packetId: string;
  accessKey: string;
  name: string;
  description: string;
  sources: KnowledgeSource[];
  createdAt: Date;
}

interface KnowledgeSource {
  id: string;
  type: 'google_doc' | 'github' | 'local' | 'notion';
  config: Record<string, any>;
  credentials?: Record<string, any>;
}

interface RegisteredClient {
  client_id: string;
  client_secret: string;
  client_name: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  scope: string;
  created_at: number;
}

class PacketMCPServer {
  private app: express.Application;
  private packets: Map<string, KnowledgePacket> = new Map();
  private transports: Record<string, SSEServerTransport> = {};
  private registeredClients: Map<string, RegisteredClient> = new Map();

  constructor() {
    this.app = express();
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.setupPackets();
    this.setupRoutes();
  }

  private setupPackets() {
    // Create our test packet
    const testPacket: KnowledgePacket = {
      packetId: "sail-architecture-demo",
      accessKey: "sail-pk-demo123",
      name: "Sail Architecture Demo", 
      description: "Demo packet showing Sail's multi-source knowledge bundling with real Google Doc and GitHub repo",
      sources: [
        {
          id: "github-repo",
          type: "github",
          config: {
            owner: "tom-mcmillan",
            repo: "sail",
            url: "https://github.com/tom-mcmillan/sail",
            description: "Sail MCP backend implementation and documentation"
          }
        },
        {
          id: "vision-doc",
          type: "google_doc",
          config: {
            docId: "1KHabk8VaD993uQwmxC2QNmn6cA-fnsRT_hjQLVkGDjA",
            url: "https://docs.google.com/document/d/1KHabk8VaD993uQwmxC2QNmn6cA-fnsRT_hjQLVkGDjA/edit",
            description: "Sail project vision and knowledge packet architecture"
          }
        }
      ],
      createdAt: new Date()
    };

    this.packets.set(testPacket.packetId, testPacket);
    console.log(`📦 Created test packet: ${testPacket.packetId}`);
  }

  private createMCPServer(packet: KnowledgePacket): McpServer {
    const server = new McpServer({
      name: `sail-packet-${packet.packetId}`,
      version: '1.0.0',
    }, { 
      capabilities: { 
        tools: {},
        resources: {},
        prompts: {}
      } 
    });

    // Cross-source search tool
    server.tool(
      'search_packet',
      `Search across all knowledge sources in ${packet.name}`,
      {
        query: z.string().describe('Search query to execute across GitHub repo, Google Docs, and other sources'),
      },
      async ({ query }): Promise<CallToolResult> => {
        // Mock search results for demo
        const results = [
          {
            source: "github-repo",
            type: "code",
            title: "Sail MCP Implementation",
            content: `Found in backend code: Knowledge packet server implementation using MCP protocol`,
            relevance: 0.95
          },
          {
            source: "vision-doc", 
            type: "document",
            title: "Sail Vision - Knowledge Packets",
            content: `From vision doc: "${query}" - Knowledge packets bundle multiple sources into single MCP endpoints`,
            relevance: 0.90
          }
        ];

        return {
          content: [{
            type: 'text',
            text: `Search results for "${query}":\\n\\n` + 
                  results.map(r => `**${r.title}** (${r.source})\\n${r.content}\\n`).join('\\n')
          }]
        };
      }
    );

    // Add resources
    server.resource(
      `packet://${packet.packetId}/sources`,
      `${packet.name} - Sources`,
      `Information about all ${packet.sources.length} knowledge sources`,
      async () => {
        return JSON.stringify({
          packet: {
            id: packet.packetId,
            name: packet.name,
            description: packet.description
          },
          sources: packet.sources.map(s => ({
            id: s.id,
            type: s.type,
            config: s.config
          }))
        }, null, 2);
      }
    );

    // Add prompt
    server.prompt(
      'analyze_packet',
      `Analyze Knowledge Packet`,
      `Provides a comprehensive analysis of the knowledge packet contents`,
      [
        {
          name: 'focus_area',
          description: 'Specific area to focus the analysis on (optional)',
          required: false
        }
      ],
      async ({ focus_area }) => {
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Please analyze the "${packet.name}" knowledge packet. This packet contains ${packet.sources.length} sources: ${packet.sources.map(s => s.type).join(', ')}. Focus on: ${focus_area || 'the overall structure and content'}`
              }
            }
          ]
        };
      }
    );

    return server;
  }

  private setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        server: 'sail-knowledge-packet',
        packets: Array.from(this.packets.keys())
      });
    });

    // Create .well-known directory endpoint (Express route handling for dots)
    this.app.use('/.well-known', express.static('public')); // This helps Express handle the .well-known path

    // OAuth 2.0 Authorization Server Metadata (RFC 8414)
    this.app.get('/.well-known/oauth-authorization-server', (req, res) => {
      const baseUrl = `https://${req.get('host')}`;
      res.json({
        issuer: baseUrl,
        authorization_endpoint: `${baseUrl}/authorize`,
        token_endpoint: `${baseUrl}/token`,
        registration_endpoint: `${baseUrl}/register`,
        grant_types_supported: ["authorization_code"],
        response_types_supported: ["code"],
        code_challenge_methods_supported: ["S256"],
        token_endpoint_auth_methods_supported: ["none"],
        scopes_supported: ["claudeai"],
        subject_types_supported: ["public"]
      });
    });

    // Alternative endpoint without dots in case Express has issues
    this.app.get('/well-known/oauth-authorization-server', (req, res) => {
      const baseUrl = `https://${req.get('host')}`;
      res.json({
        issuer: baseUrl,
        authorization_endpoint: `${baseUrl}/authorize`,
        token_endpoint: `${baseUrl}/token`,
        registration_endpoint: `${baseUrl}/register`,
        grant_types_supported: ["authorization_code"],
        response_types_supported: ["code"],
        code_challenge_methods_supported: ["S256"],
        token_endpoint_auth_methods_supported: ["none"],
        scopes_supported: ["claudeai"],
        subject_types_supported: ["public"]
      });
    });

    // OAuth 2.0 Dynamic Client Registration (RFC 7591)
    this.app.post('/register', (req, res) => {
      const {
        client_name,
        redirect_uris,
        grant_types = ["authorization_code"],
        response_types = ["code"],
        scope = "claudeai"
      } = req.body;

      // Validate redirect URIs (must be localhost or HTTPS)
      if (!redirect_uris || !Array.isArray(redirect_uris)) {
        return res.status(400).json({
          error: "invalid_redirect_uri",
          error_description: "redirect_uris is required and must be an array"
        });
      }

      for (const uri of redirect_uris) {
        const url = new URL(uri);
        if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
          return res.status(400).json({
            error: "invalid_redirect_uri", 
            error_description: "Redirect URIs must be localhost or HTTPS URLs"
          });
        }
      }

      // Generate dynamic client credentials
      const clientId = `mcp_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      const clientSecret = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);

      // Store the registered client
      const registeredClient: RegisteredClient = {
        client_id: clientId,
        client_secret: clientSecret,
        client_name: client_name || "MCP Client",
        redirect_uris: redirect_uris,
        grant_types: grant_types,
        response_types: response_types,
        scope: scope,
        created_at: Math.floor(Date.now() / 1000)
      };
      
      this.registeredClients.set(clientId, registeredClient);

      console.log(`📝 Dynamic client registration: ${client_name || 'Unknown Client'} (${clientId})`);

      // Return client registration response
      res.json({
        client_id: clientId,
        client_secret: clientSecret,
        client_name: client_name || "MCP Client",
        redirect_uris: redirect_uris,
        grant_types: grant_types,
        response_types: response_types,
        scope: scope,
        token_endpoint_auth_method: "none",
        client_id_issued_at: Math.floor(Date.now() / 1000),
        expires_in: 3600 * 24 * 30 // 30 days
      });
    });

    // OAuth authorization page
    this.app.get('/authorize', (req, res) => {
      const { client_id, redirect_uri, state, code_challenge, scope } = req.query;

      // Validate the client_id
      const client = this.registeredClients.get(client_id as string);
      if (!client) {
        return res.status(400).send(`
          <!DOCTYPE html>
          <html>
          <head><title>Invalid Client</title></head>
          <body style="font-family: Arial, sans-serif; max-width: 500px; margin: 50px auto; padding: 20px;">
            <h2>❌ Invalid Client</h2>
            <p>The client ID provided is not registered with this authorization server.</p>
            <p>Client must register using the Dynamic Client Registration endpoint first.</p>
          </body>
          </html>
        `);
      }

      // Validate redirect URI
      if (!client.redirect_uris.includes(redirect_uri as string)) {
        return res.status(400).send(`
          <!DOCTYPE html>
          <html>
          <head><title>Invalid Redirect URI</title></head>
          <body style="font-family: Arial, sans-serif; max-width: 500px; margin: 50px auto; padding: 20px;">
            <h2>❌ Invalid Redirect URI</h2>
            <p>The redirect URI provided is not registered for this client.</p>
          </body>
          </html>
        `);
      }
      
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Sail Knowledge Packet - Authorization</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 500px; margin: 50px auto; padding: 20px; }
            .form-group { margin: 15px 0; }
            input[type="text"] { width: 100%; padding: 10px; font-size: 16px; }
            button { background: #007cba; color: white; padding: 12px 20px; border: none; border-radius: 4px; cursor: pointer; }
            button:hover { background: #005a8a; }
            .info { background: #f0f8ff; padding: 15px; border-radius: 4px; margin: 20px 0; }
            .client-info { background: #f8f9fa; padding: 10px; border-radius: 4px; margin: 10px 0; font-size: 14px; }
          </style>
        </head>
        <body>
          <h2>🔑 Knowledge Packet Access</h2>
          <div class="info">
            <p><strong>You're connecting to a Sail Knowledge Packet.</strong></p>
            <p>Enter the packet access key provided by the packet creator.</p>
          </div>
          
          <div class="client-info">
            <strong>Client:</strong> ${client.client_name}<br>
            <strong>Requested Access:</strong> ${scope || 'claudeai'}
          </div>
          
          <form action="/authorize" method="post">
            <input type="hidden" name="client_id" value="${client_id}">
            <input type="hidden" name="redirect_uri" value="${redirect_uri}">
            <input type="hidden" name="state" value="${state}">
            <input type="hidden" name="code_challenge" value="${code_challenge}">
            <input type="hidden" name="scope" value="${scope}">
            
            <div class="form-group">
              <label><strong>Packet Access Key:</strong></label>
              <input type="text" name="access_key" placeholder="sail-pk-..." required>
            </div>
            
            <button type="submit">Connect to Knowledge Packet</button>
          </form>
        </body>
        </html>
      `);
    });

    // Handle OAuth authorization with packet key
    this.app.post('/authorize', (req, res) => {
      const { client_id, redirect_uri, state, access_key, code_challenge, scope } = req.body;

      // Validate the client_id
      const client = this.registeredClients.get(client_id);
      if (!client) {
        return res.status(400).send('Invalid client ID');
      }

      // Validate redirect URI
      if (!client.redirect_uris.includes(redirect_uri)) {
        return res.status(400).send('Invalid redirect URI');
      }
      
      // Validate the access key against all packets
      let validPacket = null;
      for (const packet of this.packets.values()) {
        if (packet.accessKey === access_key) {
          validPacket = packet;
          break;
        }
      }
      
      if (!validPacket) {
        return res.send(`
          <!DOCTYPE html>
          <html>
          <head><title>Invalid Access Key</title></head>
          <body style="font-family: Arial, sans-serif; max-width: 500px; margin: 50px auto; padding: 20px;">
            <h2>❌ Invalid Access Key</h2>
            <p>The access key you provided is not valid for any knowledge packet.</p>
            <p>Please check with the packet creator for the correct access key.</p>
            <button onclick="history.back()">← Go Back</button>
          </body>
          </html>
        `);
      }
      
      // Generate auth code with packet info and client info
      const authCode = `packet_${validPacket.packetId}_${client_id}_${Date.now()}`;
      
      console.log(`✅ OAuth authorization granted for packet: ${validPacket.name} by client: ${client.client_name}`);
      
      const redirectUrl = `${redirect_uri}?code=${authCode}&state=${state}`;
      res.redirect(redirectUrl);
    });

    // OAuth token exchange
    this.app.post('/token', (req, res) => {
      const { grant_type, code, client_id, code_verifier } = req.body;
      
      if (grant_type !== 'authorization_code') {
        return res.status(400).json({ 
          error: 'unsupported_grant_type',
          error_description: 'Only authorization_code grant type is supported'
        });
      }

      if (!code || !code.startsWith('packet_')) {
        return res.status(400).json({ 
          error: 'invalid_grant',
          error_description: 'Invalid authorization code'
        });
      }

      // Extract packet info and client info from auth code
      const codeParts = code.split('_');
      if (codeParts.length < 4) {
        return res.status(400).json({ 
          error: 'invalid_grant',
          error_description: 'Malformed authorization code'
        });
      }

      const [, packetId, codeClientId] = codeParts;
      
      // Validate client ID matches the one in the auth code
      if (client_id !== codeClientId) {
        return res.status(400).json({ 
          error: 'invalid_client',
          error_description: 'Client ID mismatch'
        });
      }

      // Validate client exists
      const client = this.registeredClients.get(client_id);
      if (!client) {
        return res.status(400).json({ 
          error: 'invalid_client',
          error_description: 'Client not found'
        });
      }

      // Get the packet
      const packet = this.packets.get(packetId);
      if (!packet) {
        return res.status(400).json({ 
          error: 'invalid_grant',
          error_description: 'Packet not found'
        });
      }

      // Return access token (using packet key as token)
      res.json({
        access_token: packet.accessKey,
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'claudeai',
        packet_info: {
          name: packet.name,
          description: packet.description,
          sources: packet.sources.length
        }
      });
    });

    // Packet info endpoint 
    this.app.get('/:packetId/info', (req, res) => {
      const { packetId } = req.params;
      const packet = this.packets.get(packetId);
      
      if (!packet) {
        return res.status(404).json({ error: 'Packet not found' });
      }

      res.json({
        packetId: packet.packetId,
        name: packet.name,
        description: packet.description,
        sources: packet.sources.map(s => ({
          id: s.id,
          type: s.type,
          description: s.config.description
        })),
        mcpUrl: `https://mcp.sailmcp.com/${packetId}/mcp`,
        accessKeyRequired: true
      });
    });

    // MCP SSE endpoint - GET for establishing stream
    this.app.get('/:packetId/mcp', async (req: Request, res: Response) => {
      const { packetId } = req.params;
      
      console.log(`Received GET request to /${packetId}/mcp (establishing SSE stream)`);

      try {
        // Validate packet exists
        const packet = this.packets.get(packetId);
        if (!packet) {
          return res.status(404).send('Knowledge packet not found');
        }

        // Extract access key from Authorization header
        const authHeader = req.headers.authorization;
        let accessKey = null;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
          accessKey = authHeader.substring(7);
        }

        // Validate access key
        if (!accessKey || accessKey !== packet.accessKey) {
          res.set('WWW-Authenticate', 'Bearer realm="Knowledge Packet", charset="UTF-8"');
          return res.status(401).send('Authentication required. Please provide your packet access key as Bearer token.');
        }

        console.log(`✅ Packet access granted: ${packet.name} (key: ${accessKey.substring(0, 8)}...)`);

        // Create SSE transport - messages will be sent to /{packetId}/messages
        const transport = new SSEServerTransport(`/${packetId}/messages`, res);

        // Store the transport by session ID
        const sessionId = transport.sessionId;
        this.transports[sessionId] = transport;

        // Set up onclose handler to clean up transport when closed
        transport.onclose = () => {
          console.log(`SSE transport closed for session ${sessionId}`);
          delete this.transports[sessionId];
        };

        // Connect the transport to the MCP server for this packet
        const server = this.createMCPServer(packet);
        await server.connect(transport);

        console.log(`Established SSE stream with session ID: ${sessionId} for packet: ${packet.name}`);
      } catch (error) {
        console.error('Error establishing SSE stream:', error);
        if (!res.headersSent) {
          res.status(500).send('Error establishing SSE stream');
        }
      }
    });

    // MCP Messages endpoint - POST for receiving client requests
    this.app.post('/:packetId/messages', async (req: Request, res: Response) => {
      const { packetId } = req.params;
      
      console.log(`Received POST request to /${packetId}/messages`);

      // Extract session ID from URL query parameter
      const sessionId = req.query.sessionId as string | undefined;

      if (!sessionId) {
        console.error('No session ID provided in request URL');
        res.status(400).send('Missing sessionId parameter');
        return;
      }

      const transport = this.transports[sessionId];
      if (!transport) {
        console.error(`No active transport found for session ID: ${sessionId}`);
        res.status(404).send('Session not found');
        return;
      }

      try {
        // Handle the POST message with the transport
        await transport.handlePostMessage(req, res, req.body);
      } catch (error) {
        console.error('Error handling request:', error);
        if (!res.headersSent) {
          res.status(500).send('Error handling request');
        }
      }
    });
  }

  start(port: number = 3000) {
    this.app.listen(port, () => {
      console.log(`🚀 Sail Knowledge Packet Server (MCP SDK) running on port ${port}`);
      console.log(`📦 Available packets:`);
      for (const packet of this.packets.values()) {
        console.log(`   - ${packet.name}: http://localhost:${port}/${packet.packetId}/mcp`);
        console.log(`     Access key: ${packet.accessKey}`);
      }
    });
  }

  async shutdown() {
    console.log('Shutting down server...');

    // Close all active transports to properly clean up resources
    for (const sessionId in this.transports) {
      try {
        console.log(`Closing transport for session ${sessionId}`);
        await this.transports[sessionId].close();
        delete this.transports[sessionId];
      } catch (error) {
        console.error(`Error closing transport for session ${sessionId}:`, error);
      }
    }
    console.log('Server shutdown complete');
  }
}

// Start the server
const server = new PacketMCPServer();
const port = parseInt(process.env.PORT || '3000');
server.start(port);

// Handle server shutdown
process.on('SIGINT', async () => {
  await server.shutdown();
  process.exit(0);
});