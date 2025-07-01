#!/bin/bash

echo "Starting MCP Inspector for testing..."
echo "This will open the Inspector tool in your browser"
echo ""
echo "To test your MCP server:"
echo "1. When Inspector opens, select 'HTTP' transport"
echo "2. Enter URL: http://localhost:3001/exchanges/local-files-test-125866fe/mcp"
echo "3. Click 'Connect'"
echo ""
echo "Press Enter to start the Inspector..."
read

npx @modelcontextprotocol/inspector