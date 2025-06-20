# Conversation with Claude on Friday, June 20 about MCP Servers


## Tom: 
Explain MCP to me and give me an example about how wikipedia could be come and MCP serice

## Claude: 
MCP stands for Model Context Protocol, which is a standardized way for AI assistants like Claude to connect with external data sources and tools. Think of it as a universal "plug-in" system that allows AI models to access and interact with various services, databases, and applications in a consistent way.

Here's how it works: Instead of each AI system needing custom integrations for every possible data source, MCP provides a common language and set of rules that both the AI and external services can understand. This makes it much easier to connect AI assistants to different tools and data sources.

**Wikipedia as an MCP Service Example**
Let's imagine Wikipedia implemented MCP support. Here's how it might work:

**The MCP Server Setup**: 
Wikipedia would run an MCP server that exposes several capabilities:

- **Search function**: Find articles matching specific queries
- **Content retrieval**: Get the full text or specific sections of articles
- **Metadata access**: Retrieve information about article edits, references, categories
- **Real-time updates**: Access recently edited or trending articles

**How Claude Would Use It**: When you ask me something like "What's the latest information about quantum computing?", instead of relying only on my training data, I could:

1. Connect to Wikipedia's MCP server
2. Search for quantum computing articles
3. Retrieve the most current content
4. Pull related articles about recent developments
5. Access citation information to verify facts

**The User Experience**: From your perspective, you'd just ask your question normally. But behind the scenes, I'd be pulling live, up-to-date information from Wikipedia's vast knowledge base. You might see responses that include recent discoveries, updated statistics, or breaking news that happened after my training cutoff.

**Benefits**:

- Always current information (no knowledge cutoff limitations)
- Access to Wikipedia's comprehensive citation system
- Ability to cross-reference multiple articles
- Real-time fact-checking capabilities

This would transform Wikipedia from a static reference I might mention to an active, live knowledge source I could query and interact with in real-time during our conversation.


## Tom:
ok using the publicly available Wikipedia APIs, can you mock me up an MCP server for wikipedia?

## Claude
I'll create a **mock MCP server for Wikipedia using their public APIs**. This will demonstrate how Wikipedia could work as an MCP service.

```js
#!/usr/bin/env node

/**
 * Wikipedia MCP Server
 * A Model Context Protocol server that provides access to Wikipedia content
 * using the public Wikipedia API
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

class WikipediaServer {
  constructor() {
    this.server = new Server(
      {
        name: 'wikipedia-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'search_wikipedia',
            description: 'Search Wikipedia articles by query',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query for Wikipedia articles',
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of results to return (default: 10)',
                  default: 10,
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'get_wikipedia_page',
            description: 'Get the full content of a Wikipedia page',
            inputSchema: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  description: 'Title of the Wikipedia page',
                },
                sections: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Specific sections to retrieve (optional)',
                },
              },
              required: ['title'],
            },
          },
          {
            name: 'get_wikipedia_summary',
            description: 'Get a summary/extract of a Wikipedia page',
            inputSchema: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  description: 'Title of the Wikipedia page',
                },
                sentences: {
                  type: 'number',
                  description: 'Number of sentences in summary (default: 3)',
                  default: 3,
                },
              },
              required: ['title'],
            },
          },
          {
            name: 'get_wikipedia_references',
            description: 'Get references and citations from a Wikipedia page',
            inputSchema: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  description: 'Title of the Wikipedia page',
                },
              },
              required: ['title'],
            },
          },
          {
            name: 'get_random_wikipedia_page',
            description: 'Get a random Wikipedia page',
            inputSchema: {
              type: 'object',
              properties: {
                namespace: {
                  type: 'number',
                  description: 'Wikipedia namespace (0 for articles, default: 0)',
                  default: 0,
                },
              },
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'search_wikipedia':
            return await this.searchWikipedia(args.query, args.limit || 10);

          case 'get_wikipedia_page':
            return await this.getWikipediaPage(args.title, args.sections);

          case 'get_wikipedia_summary':
            return await this.getWikipediaSummary(args.title, args.sentences || 3);

          case 'get_wikipedia_references':
            return await this.getWikipediaReferences(args.title);

          case 'get_random_wikipedia_page':
            return await this.getRandomWikipediaPage(args.namespace || 0);

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Error executing tool ${name}: ${error.message}`
        );
      }
    });
  }

  async makeWikipediaRequest(params) {
    const baseUrl = 'https://en.wikipedia.org/api/rest_v1/';
    const searchUrl = 'https://en.wikipedia.org/w/api.php';
    
    const url = params.endpoint === 'search' ? searchUrl : baseUrl + params.path;
    const queryParams = new URLSearchParams(params.params);
    
    const response = await fetch(`${url}?${queryParams}`);
    
    if (!response.ok) {
      throw new Error(`Wikipedia API error: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  }

  async searchWikipedia(query, limit) {
    const data = await this.makeWikipediaRequest({
      endpoint: 'search',
      params: {
        action: 'query',
        format: 'json',
        list: 'search',
        srsearch: query,
        srlimit: limit,
        srprop: 'snippet|titlesnippet|size|wordcount|timestamp',
      },
    });

    const results = data.query.search.map(result => ({
      title: result.title,
      snippet: result.snippet.replace(/<[^>]*>/g, ''), // Remove HTML tags
      wordcount: result.wordcount,
      size: result.size,
      timestamp: result.timestamp,
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            query,
            results_count: results.length,
            results,
          }, null, 2),
        },
      ],
    };
  }

  async getWikipediaPage(title, sections) {
    const data = await this.makeWikipediaRequest({
      path: `page/html/${encodeURIComponent(title)}`,
      params: {},
    });

    // For this mock, we'll return the raw HTML
    // In a real implementation, you'd parse the HTML to extract specific sections
    return {
      content: [
        {
          type: 'text',
          text: `Wikipedia Page Content for "${title}":\n\n${data.slice(0, 2000)}${data.length > 2000 ? '...\n[Content truncated for display]' : ''}`,
        },
      ],
    };
  }

  async getWikipediaSummary(title, sentences) {
    const data = await this.makeWikipediaRequest({
      path: `page/summary/${encodeURIComponent(title)}`,
      params: {},
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            title: data.title,
            description: data.description,
            extract: data.extract,
            page_id: data.pageid,
            lang: data.lang,
            content_urls: data.content_urls,
            thumbnail: data.thumbnail,
            coordinates: data.coordinates,
          }, null, 2),
        },
      ],
    };
  }

  async getWikipediaReferences(title) {
    // Get the page content and extract references
    // This is a simplified version - real implementation would parse the page HTML
    const data = await this.makeWikipediaRequest({
      endpoint: 'search',
      params: {
        action: 'query',
        format: 'json',
        prop: 'extlinks|categories',
        titles: title,
        ellimit: 50,
      },
    });

    const pages = data.query.pages;
    const page = Object.values(pages)[0];

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            title,
            page_id: page.pageid,
            external_links: page.extlinks || [],
            categories: page.categories || [],
          }, null, 2),
        },
      ],
    };
  }

  async getRandomWikipediaPage(namespace) {
    const data = await this.makeWikipediaRequest({
      endpoint: 'search',
      params: {
        action: 'query',
        format: 'json',
        list: 'random',
        rnnamespace: namespace,
        rnlimit: 1,
      },
    });

    const randomPage = data.query.random[0];
    
    // Get summary of the random page
    const summary = await this.getWikipediaSummary(randomPage.title, 3);

    return {
      content: [
        {
          type: 'text',
          text: `Random Wikipedia Page: ${randomPage.title}\n\n${summary.content[0].text}`,
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Wikipedia MCP server running on stdio');
  }
}

// Start the server
const server = new WikipediaServer();
server.run().catch(console.error);

export default WikipediaServer;
```

I've created a mock MCP server for Wikipedia that demonstrates how it could work as a Model Context Protocol service. Here's what this server provides:

#### Key Features

**Available Tools**:

1. **search_wikipedia** - Search for articles by query
2. **get_wikipedia_page** - Get full page content
3. **get_wikipedia_summary** - Get article summaries/extracts
4. **get_wikipedia_references** - Get citations and external links
5. **get_random_wikipedia_page** - Get a random Wikipedia page

#### How It Works
The server uses Wikipedia's public APIs:

- **REST API** (/api/rest_v1/) for summaries and page content
- **Action API** (/w/api.php) for search and metadata

#### Example Usage
If Claude were connected to this MCP server, you could ask:

- "Search Wikipedia for quantum computing" → Uses `search_wikipedia`
- "Get me a summary of the article on Machine Learning" → Uses `get_wikipedia_summary`
- "What are the references in the Climate Change article?" → Uses `get_wikipedia_references`

#### Real-World Implementation
To use this server, you'd need to:

1. **Install dependencies**:

```bash
npm install @modelcontextprotocol/sdk
```

2. **Run the server**:

```bash
node wikipedia-mcp-server.js
```

**Connect it to Claude** (or another MCP-compatible AI) through the MCP configuration

#### Benefits of This Approach

- **Live Data**: Always pulls current Wikipedia content
- **Structured Access**: Provides specific tools for different types of Wikipedia queries
- **Rich Metadata**: Can access references, categories, and page relationships
- **Extensible**: Easy to add more Wikipedia API endpoints

This mock demonstrates how MCP transforms static knowledge into dynamic, queryable resources that AI assistants can access in real-time during conversations.








