MAIN.PY

```python
#!/usr/bin/env python3
"""
Sample MCP Server for ChatGPT Deep Research Integration

This server implements the Model Context Protocol (MCP) with search and fetch
capabilities designed to work with ChatGPT's deep research feature.
"""

import logging
import os
from typing import Dict, List, Any

from fastmcp import FastMCP
from openai import OpenAI

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# OpenAI configuration
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
VECTOR_STORE_ID = os.environ.get("VECTOR_STORE_ID", "")

# Initialize OpenAI client
openai_client = OpenAI()

server_instructions = """
This MCP server provides search and document retrieval capabilities 
for deep research. Use the search tool to find relevant documents 
based on keywords, then use the fetch tool to retrieve complete 
document content with citations.
"""


def create_server():
    """Create and configure the MCP server with search and fetch tools."""

    # Initialize the FastMCP server
    mcp = FastMCP(name="Sample Deep Research MCP Server",
                  instructions=server_instructions)

    @mcp.tool()
    async def search(query: str) -> Dict[str, List[Dict[str, Any]]]:
        """
        Search for documents using OpenAI Vector Store search.
        
        This tool searches through the vector store to find semantically relevant matches.
        Returns a list of search results with basic information. Use the fetch tool to get 
        complete document content.
        
        Args:
            query: Search query string. Natural language queries work best for semantic search.
        
        Returns:
            Dictionary with 'results' key containing list of matching documents.
            Each result includes id, title, text snippet, and optional URL.
        """
        if not query or not query.strip():
            return {"results": []}

        if not openai_client:
            logger.error("OpenAI client not initialized - API key missing")
            raise ValueError(
                "OpenAI API key is required for vector store search")

        # Search the vector store using OpenAI API
        logger.info(f"Searching {VECTOR_STORE_ID} for query: '{query}'")

        response = openai_client.vector_stores.search(
            vector_store_id=VECTOR_STORE_ID, query=query)

        results = []

        # Process the vector store search results
        if hasattr(response, 'data') and response.data:
            for i, item in enumerate(response.data):
                # Extract file_id, filename, and content
                item_id = getattr(item, 'file_id', f"vs_{i}")
                item_filename = getattr(item, 'filename', f"Document {i+1}")

                # Extract text content from the content array
                content_list = getattr(item, 'content', [])
                text_content = ""
                if content_list and len(content_list) > 0:
                    # Get text from the first content item
                    first_content = content_list[0]
                    if hasattr(first_content, 'text'):
                        text_content = first_content.text
                    elif isinstance(first_content, dict):
                        text_content = first_content.get('text', '')

                if not text_content:
                    text_content = "No content available"

                # Create a snippet from content
                text_snippet = text_content[:200] + "..." if len(
                    text_content) > 200 else text_content

                result = {
                    "id": item_id,
                    "title": item_filename,
                    "text": text_snippet,
                    "url":
                    f"https://platform.openai.com/storage/files/{item_id}"
                }

                results.append(result)

        logger.info(f"Vector store search returned {len(results)} results")
        return {"results": results}

    @mcp.tool()
    async def fetch(id: str) -> Dict[str, Any]:
        """
        Retrieve complete document content by ID for detailed 
        analysis and citation. This tool fetches the full document 
        content from OpenAI Vector Store. Use this after finding 
        relevant documents with the search tool to get complete 
        information for analysis and proper citation.
        
        Args:
            id: File ID from vector store (file-xxx) or local document ID
            
        Returns:
            Complete document with id, title, full text content, 
            optional URL, and metadata
            
        Raises:
            ValueError: If the specified ID is not found
        """
        if not id:
            raise ValueError("Document ID is required")

        if not openai_client:
            logger.error("OpenAI client not initialized - API key missing")
            raise ValueError(
                "OpenAI API key is required for vector store file retrieval")

        logger.info(f"Fetching content from vector store for file ID: {id}")

        # Fetch file content from vector store
        content_response = openai_client.vector_stores.files.content(
            vector_store_id=VECTOR_STORE_ID, file_id=id)

        # Get file metadata
        file_info = openai_client.vector_stores.files.retrieve(
            vector_store_id=VECTOR_STORE_ID, file_id=id)

        # Extract content from paginated response
        file_content = ""
        if hasattr(content_response, 'data') and content_response.data:
            # Combine all content chunks from FileContentResponse objects
            content_parts = []
            for content_item in content_response.data:
                if hasattr(content_item, 'text'):
                    content_parts.append(content_item.text)
            file_content = "\n".join(content_parts)
        else:
            file_content = "No content available"

        # Use filename as title and create proper URL for citations
        filename = getattr(file_info, 'filename', f"Document {id}")

        result = {
            "id": id,
            "title": filename,
            "text": file_content,
            "url": f"https://platform.openai.com/storage/files/{id}",
            "metadata": None
        }

        # Add metadata if available from file info
        if hasattr(file_info, 'attributes') and file_info.attributes:
            result["metadata"] = file_info.attributes

        logger.info(f"Fetched vector store file: {id}")
        return result

    return mcp


def main():
    """Main function to start the MCP server."""
    # Verify OpenAI client is initialized
    if not openai_client:
        logger.error(
            "OpenAI API key not found. Please set OPENAI_API_KEY environment variable."
        )
        raise ValueError("OpenAI API key is required")

    logger.info(f"Using vector store: {VECTOR_STORE_ID}")

    # Create the MCP server
    server = create_server()

    # Configure and start the server
    logger.info("Starting MCP server on 0.0.0.0:8000")
    logger.info("Server will be accessible via SSE transport")

    try:
        # Use FastMCP's built-in run method with SSE transport
        server.run(transport="sse", host="0.0.0.0", port=8000)
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
    except Exception as e:
        logger.error(f"Server error: {e}")
        raise


if __name__ == "__main__":
    main()
```


SAMPLE_DATA.json

```json
{
  "records": [
    {
      "id": "doc_001",
      "title": "Introduction to Machine Learning",
      "text": "Machine learning is a subset of artificial intelligence that focuses on the development of algorithms and statistical models that enable computer systems to improve their performance on a specific task through experience.",
      "content": "Machine learning is a subset of artificial intelligence (AI) that focuses on the development of algorithms and statistical models that enable computer systems to improve their performance on a specific task through experience. The core principle of machine learning is to build systems that can learn from data, identify patterns, and make decisions with minimal human intervention. There are three main types of machine learning: supervised learning, unsupervised learning, and reinforcement learning. Supervised learning uses labeled data to train models, unsupervised learning finds patterns in unlabeled data, and reinforcement learning learns through interaction with an environment.",
      "url": "https://example.com/ml-intro",
      "metadata": {
        "category": "education",
        "author": "Dr. Jane Smith",
        "date": "2024-01-15",
        "tags": "machine-learning,AI,algorithms"
      }
    },
    {
      "id": "doc_002",
      "title": "Best Practices for Python Development",
      "text": "Python development best practices include following PEP 8 style guidelines, writing comprehensive tests, using virtual environments, and implementing proper error handling.",
      "content": "Python development best practices are essential for creating maintainable, readable, and efficient code. Key practices include following PEP 8 style guidelines for consistent formatting, writing comprehensive unit tests using frameworks like pytest or unittest, using virtual environments to manage dependencies, implementing proper error handling with try-except blocks, using type hints for better code documentation, following the DRY (Don't Repeat Yourself) principle, and documenting code with clear docstrings. Additionally, developers should use version control systems like Git, implement continuous integration, and regularly review and refactor code to maintain quality.",
      "url": "https://example.com/python-best-practices",
      "metadata": {
        "category": "programming",
        "author": "Alex Johnson",
        "date": "2024-02-20",
        "tags": "python,development,best-practices,coding"
      }
    },
    {
      "id": "doc_003",
      "title": "Understanding REST API Design",
      "text": "REST (Representational State Transfer) is an architectural style for designing networked applications, particularly web services. It relies on a stateless, client-server communication protocol.",
      "content": "REST (Representational State Transfer) is an architectural style for designing networked applications, particularly web services. It relies on a stateless, client-server communication protocol, typically HTTP. REST APIs use standard HTTP methods (GET, POST, PUT, DELETE) to perform operations on resources identified by URLs. Key principles include statelessness (each request contains all necessary information), resource-based URLs, proper use of HTTP status codes, and uniform interface. Good REST API design involves clear resource naming, consistent response formats (usually JSON), proper error handling, versioning strategies, and comprehensive documentation. Security considerations include authentication, authorization, input validation, and rate limiting.",
      "url": "https://example.com/rest-api-design",
      "metadata": {
        "category": "web-development",
        "author": "Maria Garcia",
        "date": "2024-03-10",
        "tags": "REST,API,web-services,HTTP"
      }
    },
    {
      "id": "doc_004",
      "title": "Database Optimization Techniques",
      "text": "Database optimization involves various strategies to improve query performance, including proper indexing, query optimization, normalization, and efficient data types.",
      "content": "Database optimization is crucial for maintaining high-performance applications as data volume grows. Key techniques include proper indexing strategies (creating indexes on frequently queried columns while avoiding over-indexing), query optimization (using EXPLAIN plans, avoiding SELECT *, optimizing JOIN operations), database normalization to reduce redundancy, choosing appropriate data types for storage efficiency, implementing connection pooling, using stored procedures for complex operations, partitioning large tables, and regular maintenance tasks like updating statistics and rebuilding indexes. Monitoring tools help identify bottlenecks and slow queries that need attention.",
      "url": "https://example.com/database-optimization",
      "metadata": {
        "category": "database",
        "author": "Robert Chen",
        "date": "2024-03-25",
        "tags": "database,optimization,performance,SQL"
      }
    },
    {
      "id": "doc_005",
      "title": "Cloud Security Fundamentals",
      "text": "Cloud security involves protecting data, applications, and infrastructure in cloud computing environments through various security measures and best practices.",
      "content": "Cloud security encompasses the policies, technologies, applications, and controls utilized to protect virtualized IP, data, applications, services, and the associated infrastructure of cloud computing. It's a shared responsibility between cloud providers and customers. Key areas include identity and access management (IAM), data encryption at rest and in transit, network security with firewalls and VPNs, compliance monitoring, vulnerability management, incident response planning, and security auditing. Best practices include implementing zero-trust architecture, regular security assessments, automated security monitoring, proper backup and disaster recovery procedures, and staff training on cloud security awareness.",
      "url": "https://example.com/cloud-security",
      "metadata": {
        "category": "security",
        "author": "Sarah Wilson",
        "date": "2024-04-05",
        "tags": "cloud,security,cybersecurity,data-protection"
      }
    }
  ]
}
```

VALIDATE_MCP.py

```python

#!/usr/bin/env python3
"""
Validate MCP server functionality by testing the actual protocol methods
"""

import asyncio
import main

async def validate_mcp_server():
    """Complete validation of MCP server functionality"""
    
    print("MCP Server Validation")
    print("=" * 21)
    
    server = main.create_server()
    
    # Test 1: List tools
    print("1. Testing list_tools...")
    try:
        tools = await server._list_tools()
        print(f"   Tools found: {len(tools)}")
        
        tool_data = []
        for tool in tools:
            data = {
                "name": tool.name,
                "description": tool.description,
                "has_schema": hasattr(tool, 'input_schema')
            }
            tool_data.append(data)
            print(f"   - {tool.name}: {tool.description[:50]}...")
        
        # Verify expected tools
        names = [t["name"] for t in tool_data]
        if "search" in names and "fetch" in names:
            print("   ✓ Both required tools present")
        else:
            print(f"   ✗ Missing tools. Found: {names}")
            
    except Exception as e:
        print(f"   ✗ List tools failed: {e}")
        return False
    
    # Test 2: Test search tool call simulation
    print("\n2. Testing search tool...")
    try:
        # Simulate what happens when MCP client calls search
        search_query = "test search"
        
        # Find search function and call it directly
        search_functions = [f for name, f in server._tool_manager._tools.items() if name == "search"]
        if search_functions:
            # This simulates the MCP call
            import main
            if main.openai_client:
                # Test the underlying OpenAI API call
                response = main.openai_client.vector_stores.search(
                    vector_store_id=main.VECTOR_STORE_ID,
                    query=search_query
                )
                print(f"   ✓ Search executed successfully, found {len(response.data)} results")
            else:
                print("   ✗ OpenAI client not available")
        else:
            print("   ✗ Search tool not found")
    except Exception as e:
        print(f"   ✗ Search test failed: {e}")
    
    # Test 3: Test fetch tool call simulation
    print("\n3. Testing fetch tool...")
    try:
        # Get a file ID from search results first
        if main.openai_client:
            search_response = main.openai_client.vector_stores.search(
                vector_store_id=main.VECTOR_STORE_ID,
                query="test"
            )
            
            if search_response.data:
                file_id = search_response.data[0].file_id
                
                # Test fetch
                content_response = main.openai_client.vector_stores.files.content(
                    vector_store_id=main.VECTOR_STORE_ID,
                    file_id=file_id
                )
                
                if content_response.data:
                    print(f"   ✓ Fetch executed successfully, retrieved {len(content_response.data[0].text)} characters")
                else:
                    print("   ✗ No content retrieved")
            else:
                print("   ✗ No files to fetch")
        else:
            print("   ✗ OpenAI client not available")
    except Exception as e:
        print(f"   ✗ Fetch test failed: {e}")
    
    # Test 4: Server accessibility  
    print("\n4. Testing server accessibility...")
    try:
        import httpx
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get("http://0.0.0.0:8000/sse/")
            if response.status_code == 200:
                print("   ✓ SSE endpoint accessible")
            else:
                print(f"   ✗ SSE endpoint returned {response.status_code}")
    except Exception as e:
        print(f"   ✗ Server not accessible: {e}")
    
    print("\nMCP validation completed!")
    return True

if __name__ == "__main__":
    asyncio.run(validate_mcp_server())
```
