#!/usr/bin/env python
"""Test MCP server functionality"""

import json
import sys
import subprocess
import asyncio
from pathlib import Path

async def test_server():
    """Test the MCP server using stdio communication"""
    
    # Start server process
    process = await asyncio.create_subprocess_exec(
        sys.executable, "-m", "src.server",
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=Path(__file__).parent
    )
    
    print("Server started, sending test requests...")
    
    # Test 1: Initialize
    init_request = {
        "jsonrpc": "2.0",
        "method": "initialize",
        "params": {
            "protocolVersion": "1.0.0",
            "capabilities": {},
            "clientInfo": {
                "name": "test-client",
                "version": "1.0.0"
            }
        },
        "id": 1
    }
    
    process.stdin.write((json.dumps(init_request) + "\n").encode())
    await process.stdin.drain()
    
    # Read response
    response = await asyncio.wait_for(process.stdout.readline(), timeout=5)
    print("Initialize response:", response.decode())
    
    # Test 2: List tools
    list_tools_request = {
        "jsonrpc": "2.0",
        "method": "tools/list",
        "params": {},
        "id": 2
    }
    
    process.stdin.write((json.dumps(list_tools_request) + "\n").encode())
    await process.stdin.drain()
    
    response = await asyncio.wait_for(process.stdout.readline(), timeout=5)
    tools_response = json.loads(response.decode())
    print("\nAvailable tools:")
    if "result" in tools_response and "tools" in tools_response["result"]:
        for tool in tools_response["result"]["tools"]:
            print(f"  - {tool['name']}: {tool.get('description', '')[:60]}...")
    
    # Test 3: Call a tool
    call_tool_request = {
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {
            "name": "list_programs",
            "arguments": {}
        },
        "id": 3
    }
    
    process.stdin.write((json.dumps(call_tool_request) + "\n").encode())
    await process.stdin.drain()
    
    response = await asyncio.wait_for(process.stdout.readline(), timeout=5)
    programs_response = json.loads(response.decode())
    print("\nPrograms list response:")
    print(json.dumps(programs_response, indent=2)[:500])
    
    # Cleanup
    process.terminate()
    await process.wait()
    print("\nTest complete!")

if __name__ == "__main__":
    asyncio.run(test_server())