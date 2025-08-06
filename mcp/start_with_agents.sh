#!/bin/bash
# Start all agents and then the MCP wrapper server

echo "Starting Lamplight AI Agents and MCP Wrapper..."
echo "================================================"

# Get the base directory
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Function to start an agent
start_agent() {
    local agent_name=$1
    local port=$2
    
    echo "Starting $agent_name on port $port..."
    cd "$BASE_DIR/agents/$agent_name" && python src/api.py > logs/${agent_name}.log 2>&1 &
    echo "  PID: $!"
    sleep 2
}

# Start all agents
start_agent "schema-agent" 8000
start_agent "document-agent" 8001
start_agent "advisory-agent" 8002
start_agent "ship-agent" 8003

echo ""
echo "All agents started. Waiting for them to initialize..."
sleep 3

# Check health
echo ""
echo "Checking agent health..."
for port in 8000 8001 8002 8003; do
    if curl -s "http://localhost:$port/health" > /dev/null; then
        echo "  ✅ Agent on port $port is healthy"
    else
        echo "  ❌ Agent on port $port is not responding"
    fi
done

echo ""
echo "Starting MCP Wrapper Server..."
echo "================================================"
cd "$BASE_DIR/mcp"
python -m src.mcp_wrapper_server

# Cleanup on exit
trap "echo 'Stopping all agents...'; pkill -f 'src/api.py'" EXIT