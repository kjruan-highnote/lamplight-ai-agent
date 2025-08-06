#!/usr/bin/env python
"""Test script to verify MCP server is working"""

import json
import sys
import subprocess
import time

def test_mcp_server():
    """Test the MCP server with a simple request"""
    
    # Start the server as a subprocess
    print("Starting MCP server...")
    process = subprocess.Popen(
        [sys.executable, "-m", "src.server"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    # Give it a moment to start
    time.sleep(2)
    
    # Send an initialization request (JSON-RPC format)
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
    
    print("Sending initialization request...")
    process.stdin.write(json.dumps(init_request) + "\n")
    process.stdin.flush()
    
    # Read response
    print("Waiting for response...")
    response_line = process.stdout.readline()
    
    if response_line:
        response = json.loads(response_line)
        print("Server responded successfully!")
        print(json.dumps(response, indent=2))
    else:
        print("No response received")
        stderr = process.stderr.read()
        if stderr:
            print("Errors:", stderr)
    
    # Clean up
    process.terminate()
    process.wait()

if __name__ == "__main__":
    test_mcp_server()