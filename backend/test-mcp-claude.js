#!/usr/bin/env node

// Test script to verify MCP server works like Claude Desktop would use it
const { spawn } = require('child_process');

const exchangeSlug = process.argv[2] || 'test-5965ec3f';

console.log(`Testing MCP server for exchange: ${exchangeSlug}`);

// Set environment variable for remote API
process.env.MCP_API_BASE_URL = 'https://sailmcp.com';

// Spawn the MCP server
const mcpServer = spawn('node', ['mcp-server.js', exchangeSlug], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: process.env
});

// Send initialize request
const initializeRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: {
      name: 'test-client',
      version: '1.0.0'
    }
  }
};

mcpServer.stdout.on('data', (data) => {
  console.log('MCP Server stdout:', data.toString());
});

mcpServer.stderr.on('data', (data) => {
  console.log('MCP Server stderr:', data.toString());
});

mcpServer.on('close', (code) => {
  console.log(`MCP Server exited with code ${code}`);
});

// Send the initialize request
setTimeout(() => {
  mcpServer.stdin.write(JSON.stringify(initializeRequest) + '\n');
  
  // Send list_tools request after a delay  
  setTimeout(() => {
    const listToolsRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list'
    };
    mcpServer.stdin.write(JSON.stringify(listToolsRequest) + '\n');
    
    // Exit after another delay
    setTimeout(() => {
      mcpServer.kill();
    }, 2000);
  }, 1000);
}, 1000);