# MCP (Model Context Protocol) Compatibility Guide

## Is MCP Specific to Claude?

**No, MCP is NOT specific to Claude.** It's an open standard protocol that any AI system can implement.

## What is MCP?

The Model Context Protocol (MCP) is an **open-source, open standard** protocol introduced by Anthropic in November 2024. It provides a universal way for AI systems to connect with data sources and tools, similar to how USB-C provides a standard connection for devices.

## Key Facts About MCP

### 1. Open Standard
- **Open Source**: Available on GitHub at [modelcontextprotocol](https://github.com/modelcontextprotocol)
- **Open Specification**: Anyone can implement the protocol
- **Community Driven**: Open to contributions from the entire community
- **MIT Licensed**: Free to use commercially

### 2. Wide Industry Adoption

#### AI Providers Using MCP:
- **Anthropic Claude** (Original creator)
- **OpenAI ChatGPT** (Adopted March 2025)
- **Google DeepMind** 
- **Microsoft Azure OpenAI**

#### Development Tools Supporting MCP:
- **Zed**
- **Replit**
- **Codeium**
- **Sourcegraph**

#### Enterprise Adopters:
- **Block**
- **Apollo**

## How Different AI Systems Use MCP

### 1. Claude Desktop
```json
{
  "mcpServers": {
    "lamplight": {
      "command": "python",
      "args": ["-m", "src.data_server"]
    }
  }
}
```

### 2. OpenAI ChatGPT

#### Via Agents SDK:
```python
from openai_agents import Agent
from openai_agents.mcp import MCPServerStdio

mcp_server = MCPServerStdio(
    command="python",
    args=["-m", "src.data_server"]
)

agent = Agent(
    name="Assistant",
    mcp_servers=[mcp_server]
)
```

#### Via ChatGPT Connectors:
- Available for ChatGPT Pro/Team/Enterprise users
- Can add custom MCP connectors to connect to internal sources

### 3. Azure OpenAI
```python
# Azure OpenAI with MCP integration
from azure.openai import OpenAIClient
from azure.openai.mcp import MCPConnector

connector = MCPConnector(
    server_command="python -m src.data_server"
)

client = OpenAIClient(
    mcp_connectors=[connector]
)
```

### 4. Custom AI Agents

Any AI agent can use MCP servers by implementing the protocol:

```python
import json
import subprocess
from typing import Dict, Any

class MCPClient:
    """Generic MCP client for any AI system"""
    
    def __init__(self, server_command: str):
        self.process = subprocess.Popen(
            server_command.split(),
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
    
    def call_tool(self, tool_name: str, arguments: Dict[str, Any]):
        """Call an MCP tool from any AI system"""
        request = {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments
            },
            "id": 1
        }
        
        # Send request
        self.process.stdin.write(json.dumps(request).encode())
        self.process.stdin.flush()
        
        # Read response
        response = self.process.stdout.readline()
        return json.loads(response)

# Use with any AI framework
mcp_client = MCPClient("python -m src.data_server")
result = mcp_client.call_tool("search_schema", {"query": "payment"})
```

## MCP Protocol Components

### Core Primitives (What MCP Servers Provide)

1. **Tools**: Executable functions AI can call
2. **Resources**: Structured data for context
3. **Prompts**: Templates and instructions

### Communication Protocol
- **Transport**: stdio, HTTP/SSE, or custom
- **Format**: JSON-RPC 2.0
- **Async**: Supports async operations

## Available SDKs

Official SDKs for building MCP servers and clients:

- **Python**: `pip install mcp`
- **TypeScript/JavaScript**: `npm install @modelcontextprotocol/sdk`
- **C#**: Available on NuGet
- **Java**: Available on Maven
- **Go**: Community implementation
- **Rust**: Community implementation

## How to Make Your MCP Server Work with Any AI

### 1. Follow MCP Specification
```python
from mcp.server import Server
from mcp.types import Tool

server = Server("my-server")

@server.tool()
async def my_tool(query: str) -> str:
    """Tool that any MCP client can call"""
    return f"Result for: {query}"
```

### 2. Provide Multiple Transport Options

#### stdio (Default):
```python
from mcp.server.stdio import stdio_server
stdio_server(server).run()
```

#### HTTP/SSE:
```python
from mcp.server.sse import sse_server
sse_server(server, port=8080).run()
```

#### WebSocket:
```python
from mcp.server.websocket import websocket_server
websocket_server(server, port=8081).run()
```

### 3. Document Your Tools
```python
@server.tool(
    description="Search GraphQL schema",
    parameters={
        "query": {"type": "string", "description": "Search query"}
    }
)
async def search_schema(query: str) -> Dict:
    """Any AI system can discover and use this tool"""
    pass
```

## Practical Examples

### 1. Using Lamplight MCP with Different AI Systems

#### With Claude:
Already configured in `claude_config.json`

#### With OpenAI:
```python
# Use OpenAI Agents SDK
from openai_agents.mcp import MCPServerStdio

server = MCPServerStdio(
    command="python",
    args=["-m", "src.data_server"],
    cwd="/path/to/lamplight/mcp"
)
```

#### With LangChain:
```python
from langchain.tools import MCPTool

tool = MCPTool(
    server_command="python -m src.data_server",
    tool_name="search_schema"
)

# Use in any LangChain agent
agent.add_tool(tool)
```

#### With Custom LLM:
```python
# Direct integration
import subprocess
import json

def query_mcp_server(query):
    cmd = ["python", "-m", "src.data_server"]
    proc = subprocess.Popen(cmd, stdin=PIPE, stdout=PIPE)
    
    request = {
        "method": "tools/call",
        "params": {"name": "search", "arguments": {"query": query}}
    }
    
    proc.stdin.write(json.dumps(request).encode())
    response = proc.stdout.readline()
    return json.loads(response)
```

## Benefits of MCP's Universal Nature

### 1. Write Once, Use Everywhere
- Single MCP server works with multiple AI systems
- No need to rewrite integrations for each AI

### 2. Standardized Interface
- Consistent API across all AI providers
- Predictable behavior and responses

### 3. Tool Portability
- Tools built for one AI work with others
- Easy migration between AI providers

### 4. Ecosystem Growth
- Shared tools benefit entire community
- Rapid adoption across industry

## Converting Lamplight Agents to Universal MCP

Your current agents can be made universally compatible:

### Current (Agent-Specific):
```python
# Ship agent - only works via HTTP API
@app.post("/generate")
async def generate_solution(request: SolutionRequest):
    return ship_agent.generate(request)
```

### Universal (MCP):
```python
# MCP server - works with any AI
@server.tool()
async def generate_solution(program_type: str):
    return ship_agent.generate(program_type)
```

Now ANY AI system supporting MCP can use this tool!

## Testing MCP Compatibility

### 1. MCP Inspector (Universal)
```bash
npx @modelcontextprotocol/inspector python -m src.data_server
```

### 2. Generic MCP Client
```python
# Test with any MCP server
from mcp.client import Client

client = Client("python -m src.data_server")
tools = client.list_tools()
result = client.call_tool("search_schema", {"query": "test"})
```

### 3. Cross-Platform Testing
```bash
# Test with different AI providers
python test_mcp_openai.py
python test_mcp_claude.py
python test_mcp_langchain.py
```

## Future-Proofing Your MCP Servers

### 1. Follow MCP Best Practices
- Return structured JSON
- Avoid LLM-specific formatting
- Use standard parameter types

### 2. Version Your API
```python
@server.tool(version="1.0")
async def my_tool_v1():
    pass

@server.tool(version="2.0")
async def my_tool_v2():
    pass
```

### 3. Support Multiple Transports
- stdio for local development
- HTTP/SSE for remote access
- WebSocket for real-time updates

## Summary

**MCP is NOT Claude-specific** - it's an open standard that:

✅ **Works with multiple AI providers** (OpenAI, Google, Microsoft, etc.)
✅ **Has official SDKs** in multiple languages
✅ **Is open source** and community-driven
✅ **Provides universal connectivity** between AI and tools
✅ **Enables tool portability** across AI systems

Your Lamplight MCP servers can be used by:
- Claude Desktop (current)
- ChatGPT (via Agents SDK or Connectors)
- Azure OpenAI
- Any custom AI agent
- Future AI systems that adopt MCP

The protocol is designed to be the "USB-C of AI" - a universal standard that works everywhere!