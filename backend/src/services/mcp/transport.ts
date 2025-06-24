import { EventEmitter } from 'events';
import { Request, Response } from 'express';
import { JSONRPCMessage, JSONRPCRequest, JSONRPCResponse, JSONRPCNotification } from '@modelcontextprotocol/sdk/types.js';

interface Session {
  id: string;
  eventStream?: Response;
  lastEventId: number;
  messageQueue: Array<{ id: string; data: any }>;
  createdAt: Date;
  lastActivity: Date;
}

export class StreamableHTTPTransport extends EventEmitter {
  private sessions: Map<string, Session> = new Map();
  private sessionTimeout = 30 * 60 * 1000; // 30 minutes

  constructor() {
    super();
    // Clean up stale sessions periodically
    setInterval(() => this.cleanupSessions(), 60 * 1000); // Every minute
  }

  /**
   * Handle incoming POST requests with JSON-RPC messages
   */
  async handlePost(req: Request, res: Response, sessionId?: string): Promise<void> {
    try {
      const message = req.body as JSONRPCMessage;
      
      if (!this.isValidJSONRPCMessage(message)) {
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32600,
            message: 'Invalid Request'
          },
          id: null
        });
        return;
      }

      // Get or create session
      const session = this.getOrCreateSession(sessionId || this.generateSessionId());
      session.lastActivity = new Date();

      // Set session ID header
      res.setHeader('Mcp-Session-Id', session.id);

      // Emit the message for processing
      this.emit('message', message, (response: JSONRPCResponse) => {
        res.json(response);
      });

    } catch (error) {
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

  /**
   * Handle GET requests to establish SSE connection
   */
  async handleGet(req: Request, res: Response, sessionId?: string): Promise<void> {
    const session = this.getOrCreateSession(sessionId || this.generateSessionId());
    session.lastActivity = new Date();

    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Mcp-Session-Id': session.id
    });

    // Store the response stream
    session.eventStream = res;

    // Send any queued messages
    if (session.messageQueue.length > 0) {
      for (const message of session.messageQueue) {
        this.sendSSEMessage(res, message.id, message.data);
        session.lastEventId++;
      }
      session.messageQueue = [];
    }

    // Send initial ping
    this.sendSSEMessage(res, String(++session.lastEventId), { type: 'ping' });

    // Handle client disconnect
    req.on('close', () => {
      if (session.eventStream === res) {
        session.eventStream = undefined;
      }
    });

    // Keep connection alive with periodic pings
    const pingInterval = setInterval(() => {
      if (session.eventStream === res) {
        this.sendSSEMessage(res, String(++session.lastEventId), { type: 'ping' });
      } else {
        clearInterval(pingInterval);
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Send a message to the client
   */
  sendToClient(sessionId: string, message: JSONRPCMessage): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const eventId = String(++session.lastEventId);
    const eventData = { ...message, jsonrpc: '2.0' };

    if (session.eventStream) {
      this.sendSSEMessage(session.eventStream, eventId, eventData);
    } else {
      // Queue message if no active stream
      session.messageQueue.push({ id: eventId, data: eventData });
    }
  }

  private sendSSEMessage(res: Response, id: string, data: any): void {
    res.write(`id: ${id}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  private isValidJSONRPCMessage(message: any): message is JSONRPCMessage {
    return message && 
           message.jsonrpc === '2.0' &&
           (('method' in message) || ('result' in message) || ('error' in message));
  }

  private getOrCreateSession(sessionId: string): Session {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = {
        id: sessionId,
        lastEventId: 0,
        messageQueue: [],
        createdAt: new Date(),
        lastActivity: new Date()
      };
      this.sessions.set(sessionId, session);
    }
    return session;
  }

  private generateSessionId(): string {
    return `mcp-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Clean up a specific session
   */
  cleanup(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      if (session.eventStream) {
        session.eventStream.end();
      }
      this.sessions.delete(sessionId);
    }
  }

  private cleanupSessions(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.lastActivity.getTime() > this.sessionTimeout) {
        if (session.eventStream) {
          session.eventStream.end();
        }
        this.sessions.delete(id);
      }
    }
  }
}