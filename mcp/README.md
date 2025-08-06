# Lamplight MCP Server

A unified Model Context Protocol (MCP) server that consolidates all Lamplight AI agent capabilities into a single, standardized interface.

## What is MCP?

MCP (Model Context Protocol) is a standardized protocol that enables AI assistants to interact with external tools and data sources. Think of it as an API specification designed specifically for AI tools, providing:

- **Tools**: Functions that AI can call (searching docs, querying schemas, generating collections)
- **Resources**: Data sources that AI can access (GraphQL schemas, documentation, program configs)
- **Context Management**: Maintains conversation state across tool calls

## Architecture Overview

This MCP server unifies four specialized agents:

1. **Schema Agent**: GraphQL schema expertise and type information
2. **Documentation Agent**: RAG-based documentation search and answers
3. **Solutions Agent**: Program-specific Postman collections and configurations
4. **Advisory Agent**: Intelligent routing and response synthesis

## Key Features

- **Unified Interface**: Single MCP connection for all agent capabilities
- **Intelligent Routing**: Automatically routes queries to appropriate agents
- **Context Preservation**: Maintains conversation context across interactions
- **Response Synthesis**: Combines multiple agent responses when needed
- **Streaming Support**: Real-time response streaming for better UX
- **Namespaced Search**: Efficient FAISS-based vector search with data separation

## Installation

### Prerequisites

- Python 3.8+
- Ollama (for LLM inference)
- MCP-compatible client (Claude Desktop, MCP CLI, etc.)

### Setup

1. **Install dependencies**:
```bash
cd mcp
pip install -e .
```

2. **Configure environment**:
```bash
cp .env.example .env
# Edit .env with your settings
```

3. **Build knowledge base** (first time only):
```bash
python scripts/build_index.py
```

## Usage

### Starting the Server

```bash
# Run directly
python -m mcp.src.server

# Or use the installed command
lamplight-mcp
```

### Connecting with Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "lamplight": {
      "command": "python",
      "args": ["-m", "mcp.src.server"],
      "cwd": "/path/to/lamplight-ai-agent/mcp"
    }
  }
}
```

### Available Tools

#### 1. `query` - Unified Query Handler
Intelligently routes queries to appropriate agents:
```
query: "How do I create a payment card?"
auto_route: true
include_sources: true
```

#### 2. `query_schema` - GraphQL Schema Queries
Direct schema information queries:
```
query: "What fields does the PaymentCard type have?"
include_examples: true
max_results: 5
```

#### 3. `query_documentation` - Documentation Search
Search Highnote documentation:
```
query: "How to implement webhooks"
category: "basics"  # optional: basics, issuing, acquiring, sdks
include_sources: true
```

#### 4. `generate_collection` - Postman Collection Generation
Generate program-specific collections:
```
program_type: "consumer_credit"
operations: ["createPaymentCard", "activateCard"]  # optional
include_tests: true
```

#### 5. `get_implementation_guide` - Implementation Guidance
Get detailed implementation guides:
```
program_type: "trip_com"
specific_query: "How to handle virtual cards"  # optional
format: "markdown"  # or "json", "yaml"
```

#### 6. `list_programs` - List Available Programs
Get all available programs and their capabilities.

#### 7. `analyze_intent` - Query Analysis (Debug)
Analyze query classification and routing:
```
query: "How do I query for payment cards in GraphQL?"
```

## How MCP Works

### Communication Flow

1. **Client Request**: AI assistant sends a tool call request via MCP protocol
2. **Tool Routing**: Server routes to appropriate tool handler
3. **Knowledge Retrieval**: Searches unified FAISS index for relevant information
4. **LLM Processing**: Generates response using context and LLM
5. **Response Return**: Sends formatted response back to client

### Example Interaction

```python
# Client (e.g., Claude) sends:
{
  "tool": "query",
  "arguments": {
    "query": "How do I create a consumer credit card with spending limits?",
    "auto_route": true
  }
}

# Server processes:
# 1. Classifies as MIXED (schema + documentation + solutions)
# 2. Searches all relevant namespaces
# 3. Retrieves GraphQL schema for createPaymentCard
# 4. Finds documentation on spending limits
# 5. Locates consumer_credit program config
# 6. Synthesizes comprehensive response

# Returns unified response combining all sources
```

## Architecture Details

### Knowledge Base Structure

```
embeddings/
├── unified.index       # FAISS index with all vectors
├── metadata.json       # Chunk metadata and mappings
└── namespaces:
    ├── [0-10000]      # Schema chunks
    ├── [10001-50000]  # Documentation chunks
    ├── [50001-70000]  # Solution patterns
    └── [70001-90000]  # Implementation guides
```

### Query Classification

The server uses pattern matching and keyword analysis to classify queries:

- **Schema**: GraphQL types, fields, mutations, queries
- **Documentation**: How-to guides, tutorials, explanations
- **Solutions**: Program-specific, Postman collections
- **Implementation**: Best practices, integration patterns
- **Mixed**: Queries spanning multiple categories

### Response Synthesis

When multiple agents provide responses, the LLM:
1. Identifies overlapping information
2. Combines unique insights from each source
3. Maintains accuracy to source material
4. Provides coherent, unified answer

## Development

### Running Tests

```bash
pytest tests/
```

### Adding New Tools

1. Define tool in `src/tools.py`:
```python
class MyNewTool:
    async def my_method(self, **kwargs):
        # Tool logic here
        pass
```

2. Register in `src/server.py`:
```python
Tool(
    name="my_tool",
    description="Tool description",
    inputSchema={...}
)
```

3. Add handler in `call_tool()` method

### Extending Knowledge Base

1. Add new data source in `knowledge_base.py`
2. Define namespace range
3. Implement chunking strategy
4. Build embeddings
5. Update index

## Configuration

See `config/server_config.json` for all configuration options:

- LLM settings (model, temperature, tokens)
- Knowledge base paths
- Agent ports (for compatibility)
- Feature flags
- Rate limits

## Troubleshooting

### Common Issues

1. **"Index not found"**: Run `python scripts/build_index.py` first
2. **"Ollama connection failed"**: Ensure Ollama is running (`ollama serve`)
3. **"No results found"**: Check if knowledge base is properly indexed
4. **"Tool not found"**: Verify MCP client configuration

### Debug Mode

Set environment variable for verbose logging:
```bash
export MCP_LOG_LEVEL=DEBUG
```

## Benefits of MCP Architecture

1. **Standardization**: Consistent interface for all AI tools
2. **Modularity**: Easy to add/remove capabilities
3. **Scalability**: Can handle multiple concurrent requests
4. **Maintainability**: Single codebase instead of multiple agents
5. **Performance**: Shared resources and caching
6. **Flexibility**: Works with any MCP-compatible client

## License

[Your License]

## Support

For issues or questions, please open an issue in the repository.