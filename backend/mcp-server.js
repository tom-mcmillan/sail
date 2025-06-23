#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const fs = require('fs').promises;
const path = require('path');

// Get the exchange slug from command line arguments
const exchangeSlug = process.argv[2];
if (!exchangeSlug) {
  console.error('Usage: node mcp-server.js <exchange-slug>');
  process.exit(1);
}

// Create MCP server
const server = new Server(
  {
    name: `sail-mcp-${exchangeSlug}`,
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Function to get exchange info from our API
async function getExchangeInfo(slug) {
  try {
    // Import fetch for Node.js
    const fetch = (await import('node-fetch')).default;
    
    // First get exchange from API
    const response = await fetch(`http://localhost:3001/api/exchanges`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    
    // Find the exchange by slug
    const exchange = data.data?.find(ex => ex.slug === slug);
    if (!exchange) {
      throw new Error(`Exchange with slug '${slug}' not found`);
    }
    
    return exchange;
  } catch (error) {
    throw new Error(`Failed to get exchange info: ${error.message}`);
  }
}

// Function to read files from folder
async function readFolder(folderPath) {
  try {
    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    const files = [];
    
    for (const entry of entries) {
      if (entry.isFile() && !entry.name.startsWith('.')) {
        const ext = path.extname(entry.name).toLowerCase();
        if (['.txt', '.md', '.json', '.csv', '.html'].includes(ext)) {
          files.push({
            name: entry.name,
            path: path.join(folderPath, entry.name),
            relativePath: entry.name
          });
        }
      }
    }
    
    return files;
  } catch (error) {
    throw new Error(`Cannot read folder: ${error.message}`);
  }
}

// Function to read file content
async function readFileContent(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch (error) {
    throw new Error(`Cannot read file: ${error.message}`);
  }
}

// Function to search files
async function searchFiles(folderPath, query, limit = 10) {
  try {
    const files = await readFolder(folderPath);
    const matchingFiles = files.filter(file => 
      file.name.toLowerCase().includes(query.toLowerCase())
    ).slice(0, limit);
    
    return matchingFiles;
  } catch (error) {
    throw new Error(`Search failed: ${error.message}`);
  }
}

// Initialize the server
async function initServer() {
  try {
    // Get exchange information
    const exchange = await getExchangeInfo(exchangeSlug);
    const folderPath = exchange.config?.folderPath;
    
    if (!folderPath) {
      throw new Error('No folder path configured for this exchange');
    }

    // List tools handler
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'search_documents',
            description: `Search through documents in ${exchange.name}`,
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query to find documents',
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of results to return',
                  default: 10,
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'get_document',
            description: 'Get the content of a specific document',
            inputSchema: {
              type: 'object',
              properties: {
                file_path: {
                  type: 'string',
                  description: 'Path to the file to read',
                },
              },
              required: ['file_path'],
            },
          },
          {
            name: 'list_files',
            description: 'List all available files in the folder',
            inputSchema: {
              type: 'object',
              properties: {
                limit: {
                  type: 'number',
                  description: 'Maximum number of files to return',
                  default: 20,
                },
              },
            },
          },
        ],
      };
    });

    // Call tool handler
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'search_documents': {
            const files = await searchFiles(folderPath, args.query, args.limit);
            return {
              content: [
                {
                  type: 'text',
                  text: `Found ${files.length} documents matching "${args.query}":\n\n` +
                    files.map(file => `📄 ${file.name}`).join('\n'),
                },
              ],
            };
          }

          case 'get_document': {
            const fullPath = path.join(folderPath, args.file_path);
            const content = await readFileContent(fullPath);
            return {
              content: [
                {
                  type: 'text',
                  text: `**${args.file_path}**\n\n${content}`,
                },
              ],
            };
          }

          case 'list_files': {
            const files = await readFolder(folderPath);
            const limitedFiles = files.slice(0, args.limit || 20);
            return {
              content: [
                {
                  type: 'text',
                  text: `📁 **Available Files** (${limitedFiles.length} files)\n\n` +
                    limitedFiles.map(file => `📄 ${file.name}`).join('\n'),
                },
              ],
            };
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });

    // Start the server
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(`Sail MCP Server connected for exchange: ${exchange.name}`);
    
  } catch (error) {
    console.error(`Failed to initialize MCP server: ${error.message}`);
    process.exit(1);
  }
}

// Start the server
initServer().catch((error) => {
  console.error('Server initialization failed:', error);
  process.exit(1);
});