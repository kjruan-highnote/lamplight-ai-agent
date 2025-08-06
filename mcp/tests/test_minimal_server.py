#!/usr/bin/env python
"""Minimal MCP server for testing"""

import asyncio
from mcp.server import Server
from mcp.server.stdio import stdio_server

async def main():
    """Run minimal MCP server"""
    server = Server("test-mcp")
    
    @server.list_tools()
    async def list_tools():
        return [
            {
                "name": "test_tool",
                "description": "A test tool",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "message": {"type": "string"}
                    }
                }
            }
        ]
    
    @server.call_tool()
    async def call_tool(name: str, arguments: dict):
        if name == "test_tool":
            return [{"type": "text", "text": f"Test response: {arguments.get('message', 'hello')}"}]
        return [{"type": "text", "text": "Unknown tool"}]
    
    print("Starting minimal MCP server...")
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, {
            "server_name": "test-mcp",
            "server_version": "1.0.0"
        })

if __name__ == "__main__":
    asyncio.run(main())