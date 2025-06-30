import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema,
  InitializeRequestSchema,
  PingRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { KnowledgeStoreAdapter } from '../adapters/base/KnowledgeStoreAdapter';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';

interface Session {
  id: string;
  server?: Server;
  transport?: StreamableHTTPServerTransport;
  adapter: KnowledgeStoreAdapter;
  createdAt: Date;
  lastActivity: Date;
}

export class UniversalMCPServer {
  private sessions: Map<string, Session> = new Map();
  private sessionTimeout = 30 * 60 * 1000; // 30 minutes

  constructor() {
    // Clean up stale sessions periodically
    setInterval(() => this.cleanupSessions(), 60 * 1000); // Every minute
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
      console.error('UniversalMCP request error:', error);
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
      // Create new session for initialize
      const newSessionId = randomUUID();
      
      // Create MCP server and transport for this session
      const server = this.createMCPServer(adapter);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => newSessionId,
        acceptContentTypes: ['application/json'] // More flexible content type handling
      });
      
      // Connect server to transport
      await server.connect(transport);
      
      session = {
        id: newSessionId,
        server,
        transport,
        adapter,
        createdAt: new Date(),
        lastActivity: new Date()
      };
      this.sessions.set(newSessionId, session);
      res.setHeader('Mcp-Session-Id', newSessionId);
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
      
      // Ensure session has server and transport
      if (!session.server || !session.transport) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Session corrupted - missing server or transport'
          },
          id: message.id || null
        });
        return;
      }
    }

    // Handle the request using session's transport
    await session.transport!.handleRequest(req, res, message);
  }

  private async handleGet(req: Request, res: Response, adapter: KnowledgeStoreAdapter, sessionId?: string): Promise<void> {
    if (!sessionId || !this.sessions.has(sessionId)) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }

    const session = this.sessions.get(sessionId)!;
    session.lastActivity = new Date();

    // Ensure session has server and transport (should be created during initialize)
    if (!session.server || !session.transport) {
      res.status(500).send('Session corrupted - missing server or transport');
      return;
    }

    // Handle SSE connection using existing transport
    await session.transport.handleRequest(req, res);
  }

  private async handleDelete(req: Request, res: Response, sessionId?: string): Promise<void> {
    if (sessionId && this.sessions.has(sessionId)) {
      const session = this.sessions.get(sessionId)!;
      if (session.transport) {
        session.transport.close();
      }
      this.sessions.delete(sessionId);
    }

    res.status(200).json({
      jsonrpc: '2.0',
      result: { status: 'disconnected' },
      id: null
    });
  }

  private createMCPServer(adapter: KnowledgeStoreAdapter): Server {
    // Get adapter capabilities
    const tools = adapter.getTools();
    const prompts = adapter.getPrompts();

    // Create MCP server with proper capabilities
    const server = new Server(
      {
        name: adapter.displayName,
        version: '1.0.0',
        description: adapter.description
      },
      {
        capabilities: {
          tools: tools.length > 0 ? {} : undefined,
          resources: {},
          prompts: prompts.length > 0 ? {} : undefined
        }
      }
    );

    // Set up handlers
    this.setupServerHandlers(server, adapter);

    return server;
  }

  private setupServerHandlers(server: Server, adapter: KnowledgeStoreAdapter): void {
    // Initialize handler
    server.setRequestHandler(InitializeRequestSchema, async (request) => {
      const tools = adapter.getTools();
      const prompts = adapter.getPrompts();
      
      return {
        protocolVersion: '1.0',
        capabilities: {
          tools: tools.length > 0 ? {} : undefined,
          resources: {},
          prompts: prompts.length > 0 ? {} : undefined
        },
        serverInfo: {
          name: adapter.displayName,
          version: '1.0.0',
          description: adapter.description
        }
      };
    });

    // Ping handler
    server.setRequestHandler(PingRequestSchema, async () => {
      return {};
    });

    // Tools
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = adapter.getTools();
      return { tools };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const result = await adapter.executeTool(name, args);
      return {
        content: result.content,
        isError: result.isError
      };
    });

    // Resources
    server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const resources = await adapter.getResources();
      return { resources };
    });

    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      const resource = await adapter.readResource(uri);
      return {
        contents: [resource]
      };
    });

    // Prompts
    server.setRequestHandler(ListPromptsRequestSchema, async () => {
      const prompts = adapter.getPrompts();
      return { prompts };
    });

    server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      // Basic prompt handling - can be extended per adapter
      return {
        description: `Prompt: ${name}`,
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Execute prompt: ${name} with arguments: ${JSON.stringify(args || {})}`
          }
        }]
      };
    });
  }

  private cleanupSessions(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.lastActivity.getTime() > this.sessionTimeout) {
        if (session.transport) {
          session.transport.close();
        }
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