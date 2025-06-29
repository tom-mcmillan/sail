# MCP Integration Reference Documentation

This directory contains comprehensive reference documentation for Model Context Protocol (MCP) remote server integrations.

## Directory Structure

### `/platforms/` - Platform-Specific Integration Documentation
Platform-specific guides and requirements for different MCP client implementations.

#### `/platforms/openai/` - OpenAI & ChatGPT Integration
- `remote-mcp-openai.md` - OpenAI Responses API MCP integration guide
- `connectors-in-chatgpt.md` - ChatGPT web app connector setup
- `synched-connectors-in-chatgpt.md` - Synchronized connector documentation  
- `building-mcp-servers-for-deep-research.md` - Deep research MCP server implementation

#### `/platforms/claude/` - Claude Integration
*Reserved for Claude-specific integration documentation*

### `/core/` - Core MCP Protocol Documentation
- `llms-full.txt` - Comprehensive MCP protocol specification and implementation details

### `/sdk/` - SDK Documentation
- `typescript-sdk/` - TypeScript SDK documentation and guides
  - `readme.md` - SDK overview and usage guide
  - `claude.md` - Claude-specific SDK configuration

### `/examples/` - Implementation Examples
- `replit-example/` - Complete MCP server implementation example
  - `readme.md` - Example overview and setup
  - `example-code.md` - Commented code examples
  - `replit.md` - Replit-specific deployment guide

## Quick Reference

### For OpenAI Responses API Integration
1. Start with `/platforms/openai/remote-mcp-openai.md`
2. Review `/examples/replit-example/` for implementation patterns
3. Reference `/core/llms-full.txt` for protocol details

### For ChatGPT Web Integration  
1. Read `/platforms/openai/connectors-in-chatgpt.md`
2. Follow `/platforms/openai/building-mcp-servers-for-deep-research.md`
3. Use `/examples/replit-example/` as implementation reference

### For Claude Integration
1. Reference `/sdk/typescript-sdk/claude.md`
2. Check main project docs for Claude-specific guides
3. Use `/core/llms-full.txt` for protocol compliance

## Documentation Standards

- **Accuracy**: All documentation reflects current MCP protocol versions
- **Completeness**: Each platform section includes authentication, transport, and tool requirements
- **Examples**: Practical implementation examples accompany theoretical documentation
- **Updates**: Documentation is kept current with protocol changes and platform updates

## Contributing

When adding new documentation:
1. Place platform-specific docs in appropriate `/platforms/` subdirectory
2. Add implementation examples to `/examples/`
3. Update this README with new content descriptions
4. Follow existing naming conventions (kebab-case for files)