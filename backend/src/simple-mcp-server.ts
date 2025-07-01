import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

/**
 * Simple Knowledge Packet MCP Server
 * Core innovation: Single MCP endpoint that bundles multiple knowledge sources
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

class SimplePacketServer {
  private server: McpServer;
  private packets: Map<string, KnowledgePacket> = new Map();

  constructor() {
    this.server = new McpServer({
      name: "sail-knowledge-packet",
      version: "1.0.0",
    });

    this.setupPackets();
    this.setupHandlers();
  }

  private setupPackets() {
    // Create our test packet: Sail Architecture Demo
    const testPacket: KnowledgePacket = {
      packetId: "sail-architecture-demo",
      accessKey: "sail-pk-demo123",
      name: "Sail Architecture Demo",
      description: "Demo packet showing Sail's multi-source knowledge bundling",
      sources: [
        {
          id: "github-repo",
          type: "github",
          config: {
            owner: "tom-mcmillan",
            repo: "sail",
            url: "https://github.com/tom-mcmillan/sail"
          }
        },
        {
          id: "vision-doc",
          type: "google_doc",
          config: {
            docId: "1KHabk8VaD993uQwmxC2QNmn6cA-fnsRT_hjQLVkGDjA",
            url: "https://docs.google.com/document/d/1KHabk8VaD993uQwmxC2QNmn6cA-fnsRT_hjQLVkGDjA/edit"
          }
        }
      ],
      createdAt: new Date()
    };

    this.packets.set(testPacket.packetId, testPacket);
  }

  private setupHandlers() {
    // List available resources in the packet
    this.server.setRequestHandler(ListResourcesRequestSchema, async (request) => {
      const packet = this.getCurrentPacket();
      if (!packet) {
        throw new Error("No valid packet found");
      }

      return {
        resources: [
          {
            uri: `packet://${packet.packetId}/search`,
            name: `Search ${packet.name}`,
            description: `Search across all sources in ${packet.name}`,
            mimeType: "application/json"
          },
          {
            uri: `packet://${packet.packetId}/sources`,
            name: `${packet.name} Sources`,
            description: `List all knowledge sources in ${packet.name}`,
            mimeType: "application/json"
          },
          ...packet.sources.map(source => ({
            uri: `packet://${packet.packetId}/source/${source.id}`,
            name: `${source.type}: ${source.id}`,
            description: `Access ${source.type} source: ${source.id}`,
            mimeType: "application/json"
          }))
        ]
      };
    });

    // Read specific resources from the packet
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const packet = this.getCurrentPacket();
      if (!packet) {
        throw new Error("No valid packet found");
      }

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
                createdAt: packet.createdAt
              },
              sources: packet.sources.map(source => ({
                id: source.id,
                type: source.type,
                config: source.config
              }))
            }, null, 2)
          }]
        };
      }

      if (uri.startsWith(`packet://${packet.packetId}/source/`)) {
        const sourceId = uri.split('/').pop();
        const source = packet.sources.find(s => s.id === sourceId);
        
        if (!source) {
          throw new Error(`Source ${sourceId} not found in packet`);
        }

        return {
          contents: [{
            uri,
            mimeType: "application/json",
            text: JSON.stringify({
              source: source,
              status: "Connected",
              note: "In production, this would fetch actual content from the source"
            }, null, 2)
          }]
        };
      }

      throw new Error(`Resource ${uri} not found`);
    });

    // Search tool for cross-source queries
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const packet = this.getCurrentPacket();
      if (!packet) {
        throw new Error("No valid packet found");
      }

      if (request.params.name === "search_packet") {
        const query = request.params.arguments?.query as string;
        if (!query) {
          throw new Error("Query parameter required");
        }

        // Mock cross-source search results
        const mockResults = [
          {
            source: "github-repo",
            type: "code",
            title: "Backend Architecture",
            content: "Knowledge packet implementation in src/simple-mcp-server.ts",
            relevance: 0.95
          },
          {
            source: "vision-doc",
            type: "document", 
            title: "Project Vision",
            content: "Knowledge packet bundling strategy and packet key architecture",
            relevance: 0.90
          }
        ];

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              query,
              results: mockResults,
              packet: packet.name,
              note: "In production, this would perform actual cross-source search"
            }, null, 2)
          }]
        };
      }

      throw new Error(`Tool ${request.params.name} not found`);
    });

    // Register the search tool
    this.server.setRequestHandler(
      { method: "tools/list" } as any,
      async () => ({
        tools: [{
          name: "search_packet",
          description: "Search across all knowledge sources in the current packet",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search query to execute across all packet sources"
              }
            },
            required: ["query"]
          }
        }]
      })
    );
  }

  private getCurrentPacket(): KnowledgePacket | null {
    // In a real implementation, this would extract packet ID from request context
    // For now, return the test packet
    return this.packets.get("sail-architecture-demo") || null;
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log("✅ Sail Knowledge Packet MCP Server started");
  }
}

// Start the server
const server = new SimplePacketServer();
server.start().catch(console.error);