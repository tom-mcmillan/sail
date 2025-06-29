# Personal Knowledge Base MCP Setup Guide

This guide shows you how to set up MCP servers for your local documents, Google Drive, and GitHub repositories to give your family and collaborators AI-powered access to your research, writings, and ideas.

## Prerequisites

1. **Node.js** (v18 or higher)
2. **MCP-compatible AI client** (Claude Desktop, or custom client)
3. **API credentials** for Google Drive and GitHub

## Installation

### 1. Install Dependencies

```bash
npm init -y
npm install @modelcontextprotocol/sdk @octokit/rest googleapis
```

### 2. Set Up Each Server

#### Local Documents Server

```bash
# Create documents directory if it doesn't exist
mkdir -p ./documents

# Run the server
node local-documents-mcp-server.js ./documents
```

**Supported file types:** `.txt`, `.md`, `.pdf`, `.doc`, `.docx`, `.json`, `.csv`, `.html`, `.rtf`

#### Google Drive Server

1. **Get Google API Credentials:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable Google Drive API and Google Docs API
   - Create a Service Account
   - Download the JSON credentials file

2. **Run the server:**
```bash
# For entire Drive access
node google-drive-mcp-server.js ./path/to/credentials.json

# For specific folder only
node google-drive-mcp-server.js ./path/to/credentials.json <folder_id>
```

#### GitHub Repository Server

1. **Get GitHub Token:**
   - Go to GitHub Settings > Developer settings > Personal access tokens
   - Create a new token with `repo` scope

2. **Run the server:**
```bash
node github-repo-mcp-server.js <your_github_token> <owner> <repo_name>
```

## Configuration for MCP Clients

### Claude Desktop Configuration

Create or update `~/.config/claude-desktop/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "local-documents": {
      "command": "node",
      "args": ["/path/to/local-documents-mcp-server.js", "/path/to/your/documents"],
      "cwd": "/path/to/mcp/servers"
    },
    "google-drive": {
      "command": "node",
      "args": ["/path/to/google-drive-mcp-server.js", "/path/to/credentials.json"],
      "cwd": "/path/to/mcp/servers",
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/credentials.json"
      }
    },
    "github-research": {
      "command": "node",
      "args": ["/path/to/github-repo-mcp-server.js", "your_token", "your_username", "research-repo"],
      "cwd": "/path/to/mcp/servers",
      "env": {
        "GITHUB_TOKEN": "your_github_token"
      }
    }
  }
}
```

## Usage Examples

Once set up, your family and collaborators can interact with your knowledge base through natural language:

### Local Documents
- "Search for my notes about machine learning"
- "Show me all markdown files modified this week"
- "Get the content of my project proposal document"
- "Find documents similar to my research paper on AI ethics"

### Google Drive
- "Find all shared documents about the family vacation"
- "Show me spreadsheets with budget information"
- "Get comments on my draft presentation"
- "List all documents I've shared with john@example.com"

### GitHub Repository
- "Search for code related to data processing"
- "Show me recent commits by Alice"
- "Find issues labeled 'bug' that are still open"
- "Get the content of the README file"
- "Find files related to the database module"

## Security Considerations

### Local Documents Server
- Runs locally, no external access by default
- Consider file permissions and access controls
- Use HTTPS if exposing over network

### Google Drive Server
- Service account has limited scope
- Store credentials securely
- Consider folder-level restrictions
- Review sharing permissions regularly

### GitHub Server
- Use Personal Access Tokens with minimal required scopes
- Consider using GitHub Apps for better security
- Rotate tokens regularly
- Monitor API usage

## Advanced Features

### Custom File Processing

For better PDF and Word document support, install additional libraries:

```bash
npm install pdf-parse mammoth
```

Update the `readFileContent` method in the local documents server to use these libraries.

### Search Indexing

For large document collections, consider implementing:
- Elasticsearch integration
- Full-text search with stemming
- Document similarity scoring
- Metadata extraction

### Collaboration Features

- **Real-time notifications**: WebSocket integration for live updates
- **Access logging**: Track who accessed what documents
- **Version control**: Git-like versioning for documents
- **Comments and annotations**: Collaborative editing features

## Deployment Options

### Local Network Access
```bash
# Run on specific IP/port for family network access
node local-documents-mcp-server.js --host 192.168.1.100 --port 3000
```

### Cloud Deployment
- Deploy on DigitalOcean, AWS, or similar
- Use Docker containers for easy deployment
- Implement authentication and authorization
- Set up SSL certificates

### Docker Setup

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "local-documents-mcp-server.js", "/app/documents"]
```

Build and run:
```bash
docker build -t knowledge-base-mcp .
docker run -v /path/to/documents:/app/documents -p 3000:3000 knowledge-base-mcp
```

## Monitoring and Maintenance

### Logging
- Implement structured logging
- Monitor API usage and rate limits
- Track search queries and popular documents

### Backup Strategy
- Regular backups of document indices
- Version control for configuration
- Database backups for metadata

### Performance Optimization
- Implement caching for frequently accessed documents
- Use CDN for static assets
- Optimize search indices
- Implement pagination for large result sets

## Troubleshooting

### Common Issues

1. **"Module not found" errors**
   - Ensure all dependencies are installed
   - Check Node.js version compatibility

2. **Google API authentication errors**
   - Verify service account credentials
   - Check API enablement in Google Cloud Console
   - Ensure proper scopes are granted

3. **GitHub rate limiting**
   - Implement request throttling
   - Use authentication to increase rate limits
   - Cache responses when possible

4. **File encoding issues**
   - Ensure UTF-8 encoding for text files
   - Handle binary files appropriately
   - Test with various file types

### Debug Mode

Run servers with debug logging:
```bash
DEBUG=* node local-documents-mcp-server.js ./documents
```

## Example Family Setup

For a family research sharing setup:

1. **Parents' Research Documents**
   - Local server for private research notes
   - Google Drive for shared family documents
   - GitHub for published research and code

2. **Children's School Projects**
   - Separate Google Drive folders with appropriate permissions
   - Version control for project evolution
   - Collaborative editing capabilities

3. **Family Knowledge Base**
   - Shared recipes, travel plans, important documents
   - Search across all family members' contributions
   - Easy access through natural language queries

This setup creates a powerful, AI-accessible knowledge base that grows with your family's research and ideas while maintaining appropriate privacy and security controls.