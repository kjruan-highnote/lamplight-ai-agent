"""
MCP Wrapper Server - Thin orchestration layer over existing agents

This approach REUSES the existing agent implementations instead of rewriting them.
The MCP server simply translates MCP protocol calls to HTTP API calls to the agents.
"""

import asyncio
import logging
import httpx
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

from mcp.server import Server, NotificationOptions
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

logger = logging.getLogger(__name__)

@dataclass
class AgentConfig:
    """Configuration for each agent"""
    name: str
    base_url: str
    description: str

class MCPWrapperServer:
    """
    MCP Server that wraps existing agent APIs
    
    Benefits:
    1. Reuses ALL existing agent code and optimizations
    2. No code duplication
    3. Agents can still run independently
    4. Easy to maintain - just one integration point
    5. Better performance - uses optimized agent code
    """
    
    def __init__(self):
        self.server = Server("lamplight-mcp-wrapper")
        
        # Agent endpoints - these are your existing agents
        self.agents = {
            "advisory": AgentConfig(
                "Advisory Agent",
                "http://localhost:8002",
                "Intelligent routing and response synthesis"
            ),
            "schema": AgentConfig(
                "Schema Agent",
                "http://localhost:8000",
                "GraphQL schema expertise"
            ),
            "document": AgentConfig(
                "Document Agent", 
                "http://localhost:8001",
                "Documentation RAG system"
            ),
            "ship": AgentConfig(
                "Ship Agent",
                "http://localhost:8003",
                "Solutions and Postman collections"
            )
        }
        
        self.client = httpx.AsyncClient(timeout=30.0)
        self._register_handlers()
    
    def _register_handlers(self):
        """Register MCP protocol handlers"""
        
        @self.server.list_tools()
        async def list_tools() -> List[Tool]:
            """List all available tools"""
            return [
                Tool(
                    name="query",
                    description="Unified query using Advisory Agent's intelligent routing",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "query": {"type": "string"},
                        },
                        "required": ["query"]
                    }
                ),
                Tool(
                    name="query_schema",
                    description="Direct GraphQL schema query",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "query": {"type": "string"},
                        },
                        "required": ["query"]
                    }
                ),
                Tool(
                    name="query_documentation",
                    description="Direct documentation query",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "query": {"type": "string"},
                            "category": {"type": "string"}
                        },
                        "required": ["query"]
                    }
                ),
                Tool(
                    name="generate_collection",
                    description="Generate Postman collection",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "program_type": {"type": "string"},
                            "operations": {"type": "array", "items": {"type": "string"}}
                        },
                        "required": ["program_type"]
                    }
                ),
                Tool(
                    name="health_check",
                    description="Check health of all agents",
                    inputSchema={
                        "type": "object",
                        "properties": {}
                    }
                )
            ]
        
        @self.server.call_tool()
        async def call_tool(name: str, arguments: Dict[str, Any]) -> List[TextContent]:
            """Route tool calls to appropriate agents"""
            
            try:
                if name == "query":
                    # Use Advisory Agent for intelligent routing
                    response = await self._call_agent(
                        "advisory",
                        "/chat",
                        method="POST",
                        json={"query": arguments["query"]}
                    )
                    return [TextContent(type="text", text=response.get("response", "No response"))]
                
                elif name == "query_schema":
                    # Direct call to Schema Agent
                    response = await self._call_agent(
                        "schema",
                        "/chat",
                        method="POST",
                        json={"query": arguments["query"]}
                    )
                    return [TextContent(type="text", text=response.get("response", "No response"))]
                
                elif name == "query_documentation":
                    # Direct call to Document Agent
                    response = await self._call_agent(
                        "document",
                        "/chat",
                        method="POST",
                        json={
                            "query": arguments["query"],
                            "category": arguments.get("category")
                        }
                    )
                    return [TextContent(type="text", text=response.get("response", "No response"))]
                
                elif name == "generate_collection":
                    # Call Ship Agent
                    response = await self._call_agent(
                        "ship",
                        "/generate/collection",
                        method="POST",
                        json={
                            "program_type": arguments["program_type"],
                            "operations": arguments.get("operations", [])
                        }
                    )
                    return [TextContent(
                        type="text",
                        text=f"Generated collection for {arguments['program_type']}"
                    )]
                
                elif name == "health_check":
                    # Check all agents
                    health_status = await self._check_all_agents_health()
                    return [TextContent(type="text", text=health_status)]
                
                else:
                    return [TextContent(type="text", text=f"Unknown tool: {name}")]
                    
            except Exception as e:
                logger.error(f"Error calling tool {name}: {e}")
                return [TextContent(type="text", text=f"Error: {str(e)}")]
    
    async def _call_agent(
        self, 
        agent_name: str, 
        endpoint: str,
        method: str = "GET",
        **kwargs
    ) -> Dict[str, Any]:
        """Call an agent's HTTP API"""
        agent = self.agents[agent_name]
        url = f"{agent.base_url}{endpoint}"
        
        logger.info(f"Calling {agent_name} agent: {method} {url}")
        
        try:
            if method == "GET":
                response = await self.client.get(url, **kwargs)
            elif method == "POST":
                response = await self.client.post(url, **kwargs)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            response.raise_for_status()
            return response.json()
            
        except httpx.HTTPError as e:
            logger.error(f"HTTP error calling {agent_name}: {e}")
            # Return a degraded response instead of failing
            return {"response": f"Agent {agent_name} is currently unavailable", "error": str(e)}
    
    async def _check_all_agents_health(self) -> str:
        """Check health of all agents"""
        health_results = []
        
        for name, agent in self.agents.items():
            try:
                response = await self.client.get(f"{agent.base_url}/health", timeout=5.0)
                if response.status_code == 200:
                    health_results.append(f"✅ {agent.name}: Healthy")
                else:
                    health_results.append(f"⚠️ {agent.name}: Unhealthy (status: {response.status_code})")
            except Exception as e:
                health_results.append(f"❌ {agent.name}: Offline ({str(e)[:30]})")
        
        return "Agent Health Status:\n" + "\n".join(health_results)
    
    async def ensure_agents_running(self):
        """Ensure all agents are running before starting MCP server"""
        print("Checking agent availability...")
        
        for name, agent in self.agents.items():
            try:
                response = await self.client.get(f"{agent.base_url}/health", timeout=5.0)
                if response.status_code == 200:
                    print(f"✅ {agent.name} is running at {agent.base_url}")
                else:
                    print(f"⚠️ {agent.name} returned status {response.status_code}")
            except Exception:
                print(f"❌ {agent.name} is not running at {agent.base_url}")
                print(f"   Please start it with: cd agents/{name}-agent && python src/api.py")
        
        print("\nMCP server will attempt to use available agents...")
    
    async def run(self):
        """Run the MCP server"""
        # Check agents first
        await self.ensure_agents_running()
        
        # Run MCP server
        async with stdio_server() as (read_stream, write_stream):
            await self.server.run(
                read_stream,
                write_stream,
                InitializationOptions(
                    server_name="lamplight-mcp-wrapper",
                    server_version="2.0.0",
                    capabilities=self.server.get_capabilities(
                        notification_options=NotificationOptions(tools_changed=True),
                        experimental_capabilities={},
                    ),
                ),
            )
    
    async def cleanup(self):
        """Cleanup resources"""
        await self.client.aclose()

async def main():
    """Main entry point"""
    server = MCPWrapperServer()
    try:
        await server.run()
    finally:
        await server.cleanup()

if __name__ == "__main__":
    asyncio.run(main())