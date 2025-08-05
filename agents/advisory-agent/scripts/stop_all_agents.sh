#!/bin/bash

# Script to stop all agents

echo "🛑 Stopping Lamplight AI Agent System..."

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
# Base directory is two levels up from scripts directory
BASE_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Function to stop agent
stop_agent() {
    local dir=$1
    local name=$2
    
    local pid_file="$BASE_DIR/$dir/logs/${name}.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        echo "🔄 Stopping $name (PID: $pid)..."
        
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid"
            sleep 2
            
            # Force kill if still running
            if kill -0 "$pid" 2>/dev/null; then
                echo "   Force killing $name..."
                kill -9 "$pid"
            fi
            
            echo "✅ Stopped $name"
        else
            echo "⚠️  $name was not running"
        fi
        
        rm -f "$pid_file"
    else
        echo "⚠️  No PID file found for $name"
    fi
}

# Stop agents in reverse order
echo "Stopping agents..."

stop_agent "ship-agent" "ship-agent"
stop_agent "advisory-agent" "advisory-agent"
stop_agent "document-agent" "document-agent"
stop_agent "schema-agent" "schema-agent"

# Also kill any remaining processes on the ports
echo ""
echo "🔍 Cleaning up any remaining processes..."

for port in 8000 8001 8002 8003; do
    pid=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$pid" ]; then
        echo "   Killing process on port $port (PID: $pid)"
        kill -9 "$pid" 2>/dev/null
    fi
done

echo ""
echo "✅ All agents stopped!"