#!/bin/bash

# Script to start all agents in the correct order

echo "🚀 Starting Lamplight AI Agent System..."

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
# Base directory is two levels up from scripts directory
BASE_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Function to wait for service to be ready
wait_for_service() {
    local url=$1
    local name=$2
    local max_attempts=30
    local attempt=1
    
    echo "⏳ Waiting for $name to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" > /dev/null 2>&1; then
            echo "✅ $name is ready!"
            return 0
        fi
        echo "   Attempt $attempt/$max_attempts - waiting for $name..."
        sleep 2
        ((attempt++))
    done
    
    echo "❌ $name failed to start after $max_attempts attempts"
    return 1
}

# Function to start agent in background
start_agent() {
    local dir=$1
    local name=$2
    local port=$3
    
    echo "🔄 Starting $name..."
    cd "$BASE_DIR/$dir"
    PYTHONPATH=. python src/api.py > "logs/${name}.log" 2>&1 &
    local pid=$!
    echo $pid > "logs/${name}.pid"
    echo "   Started $name with PID $pid"
    
    # Wait for the service to be ready
    if wait_for_service "http://localhost:$port/health" "$name"; then
        return 0
    else
        echo "❌ $name failed to start properly"
        return 1
    fi
}

# Create log directories
mkdir -p "$BASE_DIR/schema-agent/logs"
mkdir -p "$BASE_DIR/document-agent/logs"  
mkdir -p "$BASE_DIR/advisory-agent/logs"
mkdir -p "$BASE_DIR/ship-agent/logs"

echo "📋 Starting agents in sequence..."

# Start Schema Agent (port 8000)
echo ""
echo "1️⃣ Schema Agent"
if start_agent "schema-agent" "schema-agent" "8000"; then
    echo "✅ Schema Agent started successfully"
else
    echo "⚠️  Schema Agent failed to start - continuing anyway"
fi

# Start Document Agent (port 8001)
echo ""
echo "2️⃣ Document Agent"
if start_agent "document-agent" "document-agent" "8001"; then
    echo "✅ Document Agent started successfully"
else
    echo "❌ Document Agent failed to start - aborting"
    exit 1
fi

# Start Advisory Agent (port 8002)
echo ""
echo "3️⃣ Advisory Agent"
if start_agent "advisory-agent" "advisory-agent" "8002"; then
    echo "✅ Advisory Agent started successfully"
else
    echo "❌ Advisory Agent failed to start - aborting"
    exit 1
fi

# Start Ship Agent (port 8003)
echo ""
echo "4️⃣ Ship Agent"
if start_agent "ship-agent" "ship-agent" "8003"; then
    echo "✅ Ship Agent started successfully"
else
    echo "❌ Ship Agent failed to start - aborting"
    exit 1
fi

echo ""
echo "🎉 All agents started successfully!"
echo ""
echo "📍 Service URLs:"
echo "   Schema Agent:    http://localhost:8000"
echo "   Document Agent:  http://localhost:8001" 
echo "   Advisory Agent:  http://localhost:8002 (main entry point)"
echo "   Ship Agent:      http://localhost:8003"
echo ""
echo "💡 Test the advisory agent:"
echo '   curl -X POST "http://localhost:8002/chat" -H "Content-Type: application/json" -d '"'"'{"question": "How do I create a card product?"}'"'"
echo ""
echo "📊 Check status:"
echo "   curl http://localhost:8002/health"
echo ""
echo "🛑 To stop all agents, run: $SCRIPT_DIR/stop_all_agents.sh"