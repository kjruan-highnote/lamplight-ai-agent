# Lamplight Data MCP Server

## Overview

The Data MCP Server is a fast, deterministic MCP implementation that provides structured data access to GraphQL schemas, documentation, and program configurations. Unlike the hybrid server that calls LLM agents, this server returns raw JSON data for Claude to interpret directly.

## Key Benefits

### 1. **Speed & Reliability**
- **Instant responses** - No LLM processing delays
- **Deterministic output** - Same query always returns same results
- **No timeout issues** - Typically responds in <100ms
- **Works offline** - No dependency on Ollama or external services

### 2. **MCP Best Practices**
- Returns structured JSON data
- Claude handles natural language interpretation
- Clear, focused tool interfaces
- Efficient data retrieval

### 3. **Rich Data Access**
- **1,795 GraphQL types** with full field information
- **320 GraphQL operations** (queries/mutations)
- **Documentation chunks** with keyword search
- **Program configurations** for consumer credit, AP automation, etc.

## Available Tools

### Schema Tools

#### `search_schema_types`
Search for GraphQL types by name or field.
```json
{
  "query": "PaymentCard",
  "kind": "type",  // optional: type, interface, enum, input, scalar
  "limit": 10
}
```

#### `get_type_details`
Get complete details of a specific GraphQL type.
```json
{
  "type_name": "PaymentCard"
}
```

#### `search_operations`
Search for GraphQL queries and mutations.
```json
{
  "query": "create",
  "type": "mutation",  // optional: query, mutation, all
  "limit": 10
}
```

### Documentation Tools

#### `search_documentation`
Search documentation for relevant information.
```json
{
  "query": "payment processing",
  "limit": 5
}
```

### Program Tools

#### `list_programs`
List all available programs.
```json
{}
```

#### `get_program_details`
Get detailed information about a specific program.
```json
{
  "program_id": "consumer_credit"
}
```

### Utility Tools

#### `get_statistics`
Get statistics about available data.
```json
{}
```

## Installation & Usage

### 1. Test with Python
```bash
python test_data_server.py
```

### 2. Run with MCP Inspector
```bash
npx @modelcontextprotocol/inspector python -m src.data_server
```

### 3. Use with Claude Desktop

Already configured in `claude_config.json` as `lamplight-data`.

To use in Claude Desktop:
1. Copy `claude_config.json` to `~/Library/Application Support/Claude/`
2. Restart Claude Desktop
3. The server will be available as "lamplight-data"

### 4. Launch Script
```bash
./launch_data_server.sh
```

## Architecture

```
data_server.py
├── Data Loading
│   ├── _load_schema_data()     # Parse GraphQL schema
│   ├── _load_documentation()   # Load doc chunks
│   └── _load_programs()        # Load program configs
│
├── Search Functions
│   ├── _search_schema_types()  # Fuzzy search types
│   ├── _search_operations()    # Find queries/mutations
│   └── _search_documentation() # Keyword search docs
│
└── MCP Handlers
    ├── list_tools()            # Tool discovery
    └── call_tool()             # Tool execution
```

## Performance Comparison

| Server Type | Response Time | Consistency | Requirements |
|------------|--------------|-------------|--------------|
| **Data Server** | <100ms | 100% deterministic | None |
| Hybrid Server (no LLM) | ~1s | Deterministic | Python agents |
| Hybrid Server (with LLM) | 30-60s | Variable | Ollama + llama3 |
| Full LLM Server | 60-120s | Variable | Ollama + llama3 |

## Example Queries

### Find Payment Card Type
```json
Tool: search_schema_types
Input: {"query": "PaymentCard", "limit": 1}
```

### Get Payment Card Fields
```json
Tool: get_type_details
Input: {"type_name": "PaymentCard"}
```

### Find Create Mutations
```json
Tool: search_operations
Input: {"query": "create", "type": "mutation", "limit": 5}
```

### Search Documentation
```json
Tool: search_documentation
Input: {"query": "consumer credit", "limit": 3}
```

## Data Sources

The server loads data from:
- **Schema**: `/agents/schema-agent/schema/highnote.graphql`
- **Documentation**: `/agents/document-agent/data/chunks/chunk_*.txt`
- **Programs**: Hardcoded configurations for known programs

## Why Data-Focused?

The data-focused approach follows MCP best practices:

1. **Separation of Concerns**: MCP servers provide data, Claude handles interpretation
2. **Performance**: Instant responses enable real-time interaction
3. **Reliability**: No dependency on external LLM services
4. **Transparency**: Users see exactly what data is retrieved
5. **Composability**: Multiple tools can be called in parallel

## Troubleshooting

### No data returned
- Check that GraphQL schema file exists
- Verify documentation chunks are present
- Run `test_data_server.py` to validate setup

### Import errors
- Ensure you're in the `/mcp` directory
- Check Python path includes required modules

### MCP Inspector issues
- Install with: `npm install -g @modelcontextprotocol/inspector`
- Ensure Python 3.8+ is installed

## Development

To extend the server:

1. Add new data sources in `__init__`
2. Create search functions for the data
3. Register new tools in `list_tools()`
4. Handle tool calls in `call_tool()`

## Conclusion

The Data MCP Server provides the best balance of speed, reliability, and functionality for accessing Lamplight's GraphQL schemas, documentation, and program configurations. It follows MCP best practices by returning structured data for Claude to interpret, resulting in a superior user experience.