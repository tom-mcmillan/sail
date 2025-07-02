import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { CallToolRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js';

/**
 * HTTP-based Knowledge Packet Server
 * Handles packet ID routing and access key validation
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

class PacketMCPServer {
  private app: express.Application;
  private packets: Map<string, KnowledgePacket> = new Map();

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

  private setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        server: 'sail-knowledge-packet',
        packets: Array.from(this.packets.keys())
      });
    });

    // OAuth endpoints for Claude AI integration (but using packet keys)
    this.app.get('/authorize', (req, res) => {
      const { client_id, redirect_uri, state, code_challenge } = req.query;
      
      // Show a simple page where user enters their packet access key
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
          </style>
        </head>
        <body>
          <h2>🔑 Knowledge Packet Access</h2>
          <div class="info">
            <p><strong>You're connecting to a Sail Knowledge Packet.</strong></p>
            <p>Enter the packet access key provided by the packet creator.</p>
          </div>
          
          <form action="/authorize" method="post">
            <input type="hidden" name="client_id" value="${client_id}">
            <input type="hidden" name="redirect_uri" value="${redirect_uri}">
            <input type="hidden" name="state" value="${state}">
            <input type="hidden" name="code_challenge" value="${code_challenge}">
            
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
      const { client_id, redirect_uri, state, access_key } = req.body;
      
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
      
      // Generate auth code with packet info
      const authCode = `packet_${validPacket.packetId}_${Date.now()}`;
      
      console.log(`✅ OAuth authorization granted for packet: ${validPacket.name}`);
      
      const redirectUrl = `${redirect_uri}?code=${authCode}&state=${state}`;
      res.redirect(redirectUrl);
    });

    // OAuth token exchange - return the packet access key as the token
    this.app.post('/token', (req, res) => {
      const { grant_type, code, client_id } = req.body;
      
      if (grant_type === 'authorization_code' && code.startsWith('packet_')) {
        // Extract packet info from auth code
        const [, packetId] = code.split('_');
        const packet = this.packets.get(packetId);
        
        if (packet) {
          // Return the packet access key as the access token
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
        } else {
          res.status(400).json({ error: 'invalid_grant' });
        }
      } else {
        res.status(400).json({ error: 'unsupported_grant_type' });
      }
    });

    // Packet info endpoint (no auth required - for testing)
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

    // Main MCP endpoint with packet key authentication
    this.app.all('/:packetId/mcp', async (req, res) => {
      const { packetId } = req.params;
      
      try {
        // Validate packet exists
        const packet = this.packets.get(packetId);
        if (!packet) {
          return res.status(404).json({
            jsonrpc: '2.0',
            error: { code: -32002, message: 'Knowledge packet not found' },
            id: null
          });
        }

        // Extract access key from Authorization header (Claude MCP standard)
        const authHeader = req.headers.authorization;
        let accessKey = null;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
          accessKey = authHeader.substring(7);
        }

        // If no access key provided, return 401 to trigger Claude's auth prompt
        if (!accessKey) {
          res.set('WWW-Authenticate', 'Bearer realm="Knowledge Packet", charset="UTF-8"');
          return res.status(401).json({
            jsonrpc: '2.0',
            error: { 
              code: -32001, 
              message: 'Authentication required. Please provide your packet access key as Bearer token.',
              data: {
                packet: packet.name,
                instructions: 'Enter your packet access key in the authorization token field'
              }
            },
            id: null
          });
        }

        // Validate access key
        if (accessKey !== packet.accessKey) {
          return res.status(403).json({
            jsonrpc: '2.0',
            error: { 
              code: -32003, 
              message: 'Invalid access key for this knowledge packet',
              data: {
                packet: packet.name,
                providedKey: accessKey.substring(0, 8) + '...' // Show partial key for debugging
              }
            },
            id: null
          });
        }

        // Log successful access
        console.log(`✅ Packet access granted: ${packet.name} (key: ${accessKey.substring(0, 8)}...)`);

        // Handle MCP request directly (bypassing SDK for now)
        await this.handleMCPRequest(req, res, null, packet);

      } catch (error) {
        console.error('MCP request error:', error);
        res.status(500).json({
          jsonrpc: '2.0',
          error: { 
            code: -32603, 
            message: 'Internal error',
            data: error instanceof Error ? error.message : 'Unknown error'
          },
          id: null
        });
      }
    });
  }


  private async createMCPServer(packet: KnowledgePacket): Promise<McpServer> {
    const server = new McpServer({
      name: `packet-${packet.packetId}`,
      version: "1.0.0",
    });

    // List resources in this packet
    server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: `packet://${packet.packetId}/search`,
          name: `Search ${packet.name}`,
          description: `Cross-source search across: ${packet.sources.map(s => s.type).join(', ')}`,
          mimeType: "application/json"
        },
        {
          uri: `packet://${packet.packetId}/sources`,
          name: `${packet.name} - Source List`,
          description: `Information about all ${packet.sources.length} knowledge sources in this packet`,
          mimeType: "application/json"
        },
        ...packet.sources.map(source => ({
          uri: `packet://${packet.packetId}/source/${source.id}`,
          name: `${source.type}: ${source.id}`,
          description: source.config.description || `${source.type} knowledge source`,
          mimeType: "application/json"
        }))
      ]
    }));

    // Read resources
    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;
      
      if (uri === `packet://${packet.packetId}/sources`) {
        return {
          contents: [{
            uri,
            mimeType: "application/json",
            text: JSON.stringify({
              packet: {
                id: packet.packetId,
                name: packet.name,
                description: packet.description,
                totalSources: packet.sources.length
              },
              sources: packet.sources.map(source => ({
                id: source.id,
                type: source.type,
                description: source.config.description,
                url: source.config.url
              }))
            }, null, 2)
          }]
        };
      }

      if (uri.startsWith(`packet://${packet.packetId}/source/`)) {
        const sourceId = uri.split('/').pop();
        const source = packet.sources.find(s => s.id === sourceId);
        
        if (!source) {
          throw new Error(`Source ${sourceId} not found`);
        }

        // Mock source content - in production this would fetch real data
        const mockContent = this.getMockSourceContent(source);
        
        return {
          contents: [{
            uri,
            mimeType: "application/json", 
            text: JSON.stringify(mockContent, null, 2)
          }]
        };
      }

      throw new Error(`Resource ${uri} not found`);
    });

    // Cross-source search tool
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name === "search_packet") {
        const query = request.params.arguments?.query as string;
        if (!query) {
          throw new Error("Query parameter required");
        }

        const results = await this.performCrossSourceSearch(packet, query);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              query,
              packet: packet.name,
              searchedSources: packet.sources.length,
              results,
              note: "This is a demo implementation. Production would perform real API calls to GitHub and Google Docs."
            }, null, 2)
          }]
        };
      }

      throw new Error(`Tool ${request.params.name} not found`);
    });

    // Register tools
    server.setRequestHandler(
      { method: "tools/list" } as any,
      async () => ({
        tools: [{
          name: "search_packet",
          description: `Search across all knowledge sources in ${packet.name}`,
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search query to execute across GitHub repo, Google Docs, and other sources"
              }
            },
            required: ["query"]
          }
        }]
      })
    );

    return server;
  }

  private getMockSourceContent(source: KnowledgeSource): any {
    switch (source.type) {
      case 'github':
        return {
          source: source,
          content: {
            type: "GitHub Repository",
            files: ["README.md", "src/", "docs/", "package.json"],
            recentCommits: ["feat: implement packet key system", "fix: update MCP architecture"],
            issues: ["Implement cross-source search", "Add Google OAuth integration"],
            description: "Backend implementation of Sail MCP knowledge packet system"
          },
          status: "Connected via GitHub API"
        };
      
      case 'google_doc':
        return {
          source: source,
          content: {
            type: "Google Document",
            title: "Sail Project Vision",
            sections: ["Knowledge Packet Architecture", "Bundling Strategy", "Auth Flow"],
            lastModified: "2025-01-01",
            description: "Strategic vision and technical architecture for knowledge packet bundling"
          },
          status: "Connected via Google Drive API"
        };
      
      default:
        return { source, status: "Unknown source type" };
    }
  }

  private async performCrossSourceSearch(packet: KnowledgePacket, query: string): Promise<any[]> {
    // Mock cross-source search results
    const results = [];

    for (const source of packet.sources) {
      if (source.type === 'github') {
        results.push({
          source: source.id,
          type: "code",
          title: "Knowledge Packet Implementation",
          snippet: "// Knowledge Packet MCP Server implementation\nclass PacketMCPServer {\n  private packets: Map<string, KnowledgePacket>",
          url: "https://github.com/tom-mcmillan/sail/blob/main/backend/src/packet-server.ts",
          relevance: 0.9
        });
      }

      if (source.type === 'google_doc') {
        results.push({
          source: source.id,
          type: "document",
          title: "Project Vision - Knowledge Packets",
          snippet: "A Knowledge Packet is a virtualized MCP server that aggregates multiple heterogeneous knowledge sources...",
          url: source.config.url,
          relevance: 0.95
        });
      }
    }

    return results.sort((a, b) => b.relevance - a.relevance);
  }

  private async handleMCPRequest(req: express.Request, res: express.Response, mcpServer: McpServer | null, packet: KnowledgePacket) {
    // For now, handle basic MCP requests manually
    // In production, this would use SSEServerTransport properly
    
    if (req.method === 'GET') {
      // Check if client wants SSE
      const acceptHeader = req.headers.accept || '';
      
      if (acceptHeader.includes('text/event-stream')) {
        // SSE response
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Cache-Control'
        });
        
        // Send initial message
        res.write(`data: ${JSON.stringify({
          jsonrpc: '2.0',
          result: {
            name: `sail-packet-${packet.packetId}`,
            packet: packet.name,
            message: "SSE connection established"
          },
          id: 1
        })}\n\n`);
        
        // Keep connection alive
        const keepAlive = setInterval(() => {
          res.write(`data: ${JSON.stringify({
            jsonrpc: '2.0',
            result: { message: "keepalive" },
            id: Date.now()
          })}\n\n`);
        }, 30000);
        
        req.on('close', () => {
          clearInterval(keepAlive);
        });
      } else {
        // Regular JSON response
        res.json({
          jsonrpc: '2.0',
          result: {
            packet: {
              id: packet.packetId,
              name: packet.name,
              description: packet.description,
              sources: packet.sources.length
            },
            instructions: "Use MCP client to connect to this endpoint for full functionality"
          },
          id: 1
        });
      }
    } else {
      // Handle MCP JSON-RPC requests
      const mcpRequest = req.body;
      
      // Handle MCP JSON-RPC requests
      if (mcpRequest.method === 'initialize') {
        res.json({
          jsonrpc: '2.0',
          id: mcpRequest.id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
              resources: {},
              prompts: {}
            },
            serverInfo: {
              name: `sail-packet-${packet.packetId}`,
              version: "1.0.0"
            }
          }
        });
      } else if (mcpRequest.method === 'notifications/initialized') {
        // Acknowledge the initialized notification
        res.json({
          jsonrpc: '2.0',
          id: mcpRequest.id,
          result: {}
        });
      } else if (mcpRequest.method === 'resources/list') {
        // Return available resources
        const resources = [
          {
            uri: `packet://${packet.packetId}/search`,
            name: `Search ${packet.name}`,
            description: `Cross-source search across: ${packet.sources.map(s => s.type).join(', ')}`,
            mimeType: "application/json"
          },
          {
            uri: `packet://${packet.packetId}/sources`,
            name: `${packet.name} - Sources`,
            description: `Information about all ${packet.sources.length} knowledge sources`,
            mimeType: "application/json"
          }
        ];
        
        res.json({
          jsonrpc: '2.0',
          id: mcpRequest.id,
          result: { 
            resources: resources
          }
        });
      } else if (mcpRequest.method === 'tools/list') {
        // Return available tools
        const tools = [{
          name: "search_packet",
          description: `Search across all knowledge sources in ${packet.name}`,
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search query to execute across GitHub repo, Google Docs, and other sources"
              }
            },
            required: ["query"]
          }
        }];
        
        res.json({
          jsonrpc: '2.0',
          id: mcpRequest.id,
          result: { tools }
        });
      } else if (mcpRequest.method === 'prompts/list') {
        // Return available prompts
        const prompts = [{
          name: "analyze_packet",
          title: "Analyze Knowledge Packet",
          description: "Provides a comprehensive analysis of the knowledge packet contents",
          arguments: [
            {
              name: "focus_area",
              description: "Specific area to focus the analysis on (optional)",
              required: false
            }
          ]
        }];
        
        res.json({
          jsonrpc: '2.0',
          id: mcpRequest.id,
          result: { 
            prompts: prompts
          }
        });
      } else if (mcpRequest.method === 'tools/call') {
        // Handle tool execution
        const { name, arguments: args } = mcpRequest.params;
        
        if (name === 'search_packet') {
          const query = args?.query || '';
          
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
          
          res.json({
            jsonrpc: '2.0',
            id: mcpRequest.id,
            result: {
              content: [{
                type: "text",
                text: `Search results for "${query}":\n\n` + 
                      results.map(r => `**${r.title}** (${r.source})\n${r.content}\n`).join('\n')
              }]
            }
          });
        } else {
          res.status(404).json({
            jsonrpc: '2.0',
            id: mcpRequest.id,
            error: {
              code: -32601,
              message: `Tool not found: ${name}`
            }
          });
        }
      } else if (mcpRequest.method === 'resources/read') {
        // Handle resource reading
        const { uri } = mcpRequest.params;
        
        if (uri === `packet://${packet.packetId}/sources`) {
          res.json({
            jsonrpc: '2.0',
            id: mcpRequest.id,
            result: {
              contents: [{
                uri: uri,
                mimeType: "application/json",
                text: JSON.stringify({
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
                }, null, 2)
              }]
            }
          });
        } else {
          res.status(404).json({
            jsonrpc: '2.0',
            id: mcpRequest.id,
            error: {
              code: -32002,
              message: `Resource not found: ${uri}`
            }
          });
        }
      } else if (mcpRequest.method === 'prompts/get') {
        // Handle prompt retrieval
        const { name } = mcpRequest.params;
        
        if (name === 'analyze_packet') {
          res.json({
            jsonrpc: '2.0',
            id: mcpRequest.id,
            result: {
              prompt: {
                name: "analyze_packet",
                title: "Analyze Knowledge Packet",
                description: "Provides a comprehensive analysis of the knowledge packet contents",
                messages: [
                  {
                    role: "user",
                    content: {
                      type: "text",
                      text: `Please analyze the "${packet.name}" knowledge packet. This packet contains ${packet.sources.length} sources: ${packet.sources.map(s => s.type).join(', ')}. Focus on: {{focus_area|the overall structure and content}}`
                    }
                  }
                ]
              }
            }
          });
        } else {
          res.status(404).json({
            jsonrpc: '2.0',
            id: mcpRequest.id,
            error: {
              code: -32002,
              message: `Prompt not found: ${name}`
            }
          });
        }
      } else {
        // Log unknown method for debugging
        console.log(`Unknown MCP method: ${mcpRequest.method}`);
        
        res.json({
          jsonrpc: '2.0',
          id: mcpRequest.id,
          result: { 
            message: `${packet.name} packet is ready`,
            sources: packet.sources.length,
            authenticated: true,
            unknownMethod: mcpRequest.method
          }
        });
      }
    }
  }

  start(port: number = 3000) {
    this.app.listen(port, () => {
      console.log(`🚀 Sail Knowledge Packet Server running on port ${port}`);
      console.log(`📦 Available packets:`);
      for (const packet of this.packets.values()) {
        console.log(`   - ${packet.name}: http://localhost:${port}/${packet.packetId}/mcp`);
        console.log(`     Access key: ${packet.accessKey}`);
      }
    });
  }
}

// Start the server
const server = new PacketMCPServer();
const port = parseInt(process.env.PORT || '3000');
server.start(port);