import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { KnowledgeStoreAdapter } from '../adapters/base/KnowledgeStoreAdapter';
import { Request, Response } from 'express';
import { z } from 'zod';

interface Session {
  id: string;
  server: McpServer;
  transport: StreamableHTTPServerTransport;
  adapter: KnowledgeStoreAdapter;
  createdAt: Date;
  lastActivity: Date;
}

export class McpServerSDK {
  private sessions: Map<string, Session> = new Map();
  private sessionTimeout = 30 * 60 * 1000; // 30 minutes

  constructor() {
    // Clean up stale sessions periodically
    setInterval(() => this.cleanupSessions(), 60 * 1000);
  }

  async handleRequest(req: Request, res: Response, adapter: KnowledgeStoreAdapter): Promise<void> {
    try {
      const sessionId = req.headers['mcp-session-id'] as string;
      
      // Handle different HTTP methods
      switch (req.method) {
        case 'POST':
          await this.handlePost(req, res, adapter, sessionId);
          break;
        case 'GET':
          await this.handleGet(req, res, adapter, sessionId);
          break;
        case 'DELETE':
          await this.handleDelete(req, res, sessionId);
          break;
        case 'OPTIONS':
          res.status(200).json({});
          break;
        default:
          res.status(405).json({
            jsonrpc: '2.0',
            error: {
              code: -32601,
              message: `Method ${req.method} not allowed`
            },
            id: null
          });
      }
    } catch (error) {
      console.error('McpServerSDK request error:', error);
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
  }

  private async handlePost(req: Request, res: Response, adapter: KnowledgeStoreAdapter, sessionId?: string): Promise<void> {
    const message = req.body;
    let session: Session;

    // Handle session management
    if (message.method === 'initialize') {
      // For initialize, create new session (even if we have a sessionId from previous attempts)
      session = await this.createSession(adapter);
      res.setHeader('Mcp-Session-Id', session.id);
    } else {
      // Use existing session
      if (!sessionId || !this.sessions.has(sessionId)) {
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32600,
            message: 'Invalid or missing session ID'
          },
          id: message.id || null
        });
        return;
      }
      session = this.sessions.get(sessionId)!;
      session.lastActivity = new Date();
    }

    // Handle the request using session's transport
    await session.transport.handleRequest(req, res, message);
  }

  private async handleGet(req: Request, res: Response, adapter: KnowledgeStoreAdapter, sessionId?: string): Promise<void> {
    // If no session ID, return server info with OAuth endpoints for discovery
    if (!sessionId) {
      res.json({
        name: adapter.displayName,
        description: adapter.description,
        version: '1.0.0',
        protocol: 'mcp',
        capabilities: {
          tools: {
            listChanged: true
          },
          resources: {
            listChanged: true
          },
          prompts: {
            listChanged: true
          }
        },
        oauth: {
          authorization_endpoint: `${process.env.BASE_URL}/oauth/authorize`,
          token_endpoint: `${process.env.BASE_URL}/oauth/token`,
          registration_endpoint: `${process.env.BASE_URL}/oauth/register`,
          scopes_supported: ['mcp:read']
        }
      });
      return;
    }

    if (!this.sessions.has(sessionId)) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }

    const session = this.sessions.get(sessionId)!;
    session.lastActivity = new Date();

    // Handle SSE connection using existing transport
    await session.transport.handleRequest(req, res);
  }

  private async handleDelete(req: Request, res: Response, sessionId?: string): Promise<void> {
    if (sessionId && this.sessions.has(sessionId)) {
      const session = this.sessions.get(sessionId)!;
      session.transport.close();
      this.sessions.delete(sessionId);
    }

    res.status(200).json({
      jsonrpc: '2.0',
      result: { status: 'disconnected' },
      id: null
    });
  }

  private async createSession(adapter: KnowledgeStoreAdapter): Promise<Session> {
    // Create high-level MCP server
    const server = new McpServer({
      name: adapter.displayName,
      version: '1.0.0'
    });

    // Register tools using high-level API
    this.registerAdapterTools(server, adapter);

    // Register resources using high-level API
    this.registerAdapterResources(server, adapter);

    // Register prompts using high-level API
    this.registerAdapterPrompts(server, adapter);

    // Create transport
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => this.generateSessionId()
    });

    // Connect server to transport
    await server.connect(transport);

    // Create session
    const session: Session = {
      id: this.generateSessionId(),
      server,
      transport,
      adapter,
      createdAt: new Date(),
      lastActivity: new Date()
    };

    this.sessions.set(session.id, session);
    return session;
  }

  private registerAdapterTools(server: McpServer, adapter: KnowledgeStoreAdapter): void {
    const tools = adapter.getTools();

    tools.forEach(tool => {
      // Convert JSON Schema to Zod raw shape for SDK compatibility
      const zodRawShape = this.jsonSchemaToZodRawShape(tool.inputSchema);

      server.registerTool(
        tool.name,
        {
          title: tool.name,
          description: tool.description,
          inputSchema: zodRawShape
        },
        async (args: any, extra: any) => {
          const result = await adapter.executeTool(tool.name, args);
          
          // Convert our result format to SDK format - ensure proper content format
          const content = result.content.map(item => {
            if (item.type === 'text') {
              return {
                type: 'text' as const,
                text: item.text || ''
              };
            } else if (item.type === 'image') {
              return {
                type: 'image' as const,
                data: item.data || '',
                mimeType: item.mimeType || 'image/png'
              };
            } else if (item.type === 'resource') {
              return {
                type: 'resource' as const,
                resource: {
                  uri: item.uri || '',
                  text: item.text || '',
                  mimeType: item.mimeType
                }
              };
            }
            // Default to text
            return {
              type: 'text' as const,
              text: JSON.stringify(item)
            };
          });

          return {
            content,
            isError: result.isError
          };
        }
      );
    });
  }

  private registerAdapterResources(server: McpServer, adapter: KnowledgeStoreAdapter): void {
    // Register a resource template for dynamic file access
    const template = new ResourceTemplate(
      `file:///${adapter.storeType}/{path}`,
      {
        list: async () => {
          const resources = await adapter.getResources();
          return {
            resources: resources.map(resource => ({
              uri: resource.uri,
              name: resource.name,
              description: resource.description,
              mimeType: resource.mimeType
            }))
          };
        }
      }
    );

    server.registerResource(
      'file-resources',
      template,
      {
        title: 'File Resources',
        description: 'Access files from the knowledge store'
      },
      async (uri: URL, variables: any, extra: any) => {
        const resourceContent = await adapter.readResource(uri.toString());
        
        // Convert to SDK format
        const contents = resourceContent.contents.map(item => ({
          uri: item.uri,
          text: item.text || '',
          mimeType: item.mimeType
        }));

        return {
          contents
        };
      }
    );
  }

  private registerAdapterPrompts(server: McpServer, adapter: KnowledgeStoreAdapter): void {
    const prompts = adapter.getPrompts();

    prompts.forEach(prompt => {
      // Convert prompt arguments to Zod raw shape
      const argumentShape = (prompt.arguments || []).reduce((acc, arg) => {
        acc[arg.name] = arg.required ? z.string() : z.string().optional();
        return acc;
      }, {} as Record<string, any>);

      server.registerPrompt(
        prompt.name,
        {
          title: prompt.name,
          description: prompt.description,
          argsSchema: argumentShape
        },
        async (args: any) => {
          return {
            description: prompt.description,
            messages: [{
              role: 'user',
              content: {
                type: 'text',
                text: `Execute prompt: ${prompt.name} with arguments: ${JSON.stringify(args)}`
              }
            }]
          };
        }
      );
    });
  }

  private jsonSchemaToZodRawShape(schema: any): Record<string, z.ZodTypeAny> {
    // Simple conversion from JSON Schema to Zod raw shape
    // This is a basic implementation - could be enhanced
    if (schema.type === 'object') {
      const shape: Record<string, z.ZodTypeAny> = {};
      
      for (const [key, prop] of Object.entries(schema.properties || {})) {
        const property = prop as any;
        let zodProp: z.ZodTypeAny;
        
        switch (property.type) {
          case 'string':
            zodProp = z.string();
            if (property.description) {
              zodProp = zodProp.describe(property.description);
            }
            break;
          case 'number':
            zodProp = z.number();
            if (property.minimum !== undefined) {
              zodProp = (zodProp as z.ZodNumber).min(property.minimum);
            }
            if (property.maximum !== undefined) {
              zodProp = (zodProp as z.ZodNumber).max(property.maximum);
            }
            if (property.description) {
              zodProp = zodProp.describe(property.description);
            }
            break;
          case 'boolean':
            zodProp = z.boolean();
            if (property.description) {
              zodProp = zodProp.describe(property.description);
            }
            break;
          default:
            zodProp = z.any();
        }
        
        // Make optional if not required
        if (!schema.required?.includes(key)) {
          zodProp = zodProp.optional();
        }
        
        shape[key] = zodProp;
      }
      
      return shape;
    }
    
    return {};
  }

  private generateSessionId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  private cleanupSessions(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.lastActivity.getTime() > this.sessionTimeout) {
        session.transport.close();
        this.sessions.delete(id);
        console.log(`Cleaned up stale session: ${id}`);
      }
    }
  }

  // Get session info for debugging
  getSessionInfo(): Array<{id: string, adapter: string, lastActivity: Date}> {
    return Array.from(this.sessions.values()).map(session => ({
      id: session.id,
      adapter: session.adapter.storeType,
      lastActivity: session.lastActivity
    }));
  }
}