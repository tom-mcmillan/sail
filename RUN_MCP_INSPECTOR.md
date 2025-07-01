# Testing with MCP Inspector

## Prerequisites
1. Make sure the backend server is running on port 3001
2. The test exchange has been created in the database

## Run the Inspector

Open a new terminal and run:
```bash
npx @modelcontextprotocol/inspector
```

## Configure the Inspector

When the Inspector opens in your browser:

1. **Select Transport**: Choose "HTTP" from the dropdown
2. **Enter URL**: `http://localhost:3001/local-files-test-125866fe/mcp`
3. **Click "Connect"**

## Test OAuth Flow (if required)

If the server requires OAuth:
1. The Inspector should redirect you to the OAuth flow
2. Complete the authentication
3. The Inspector will reconnect with the token

## What to Check

1. **Tools Tab**: Should show:
   - search
   - fetch
   - list

2. **Resources Tab**: Should show file resources

3. **Prompts Tab**: Should show available prompts

4. **Test Each Tool**:
   - Try searching for files
   - Try fetching a specific file
   - Try listing directory contents

## Debugging

- Check the server logs in the terminal running the backend
- Look for errors in the Inspector's notification pane
- Check the browser console for any JavaScript errors