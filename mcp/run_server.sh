#!/bin/bash
# Launch script for Lamplight MCP Server

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Change to the script directory
cd "$SCRIPT_DIR"

echo "Starting Lamplight MCP Server..."
echo "Directory: $SCRIPT_DIR"
echo ""

# Run the server
python -m src.server