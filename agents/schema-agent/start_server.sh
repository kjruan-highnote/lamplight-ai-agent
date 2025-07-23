#!/bin/bash

# GraphQL Schema QA API Server Startup Script
set -e

echo "🚀 Starting GraphQL Schema QA API Server"
echo "======================================="

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok is not installed. Please install it first:"
    echo "   macOS: brew install ngrok"
    echo "   Other: https://ngrok.com/download"
    exit 1
fi

# Check if Ollama is running
if ! curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
    echo "❌ Ollama is not running. Please start Ollama first:"
    echo "   ollama serve"
    echo "   Then install a model: ollama pull llama3"
    exit 1
fi

# Check for required model
if ! ollama list | grep -q "llama3"; then
    echo "❌ llama3 model not found. Installing..."
    ollama pull llama3
fi

# Set environment variables for no-auth setup
export ENABLE_AUTH=false
export ALLOWED_ORIGINS="*"
export HOST=0.0.0.0
export PORT=8000

# Check Python dependencies
echo "🔍 Checking Python dependencies..."
python -c "import fastapi, uvicorn, slowapi, ollama" 2>/dev/null || {
    echo "❌ Missing Python dependencies. Installing..."
    pip install -r requirements.txt
}

echo "✅ Environment configured (no authentication)"
echo "✅ Host: $HOST:$PORT"

# Check if embeddings exist
if [ ! -f "embeddings/index.faiss" ] || [ ! -f "embeddings/metadata.json" ]; then
    echo "❌ Embeddings not found. Creating embeddings from chunks..."
    python -m agent.embedder --chunks chunks --out_index embeddings/index.faiss --out_meta embeddings/metadata.json
    echo "✅ Embeddings created successfully"
else
    echo "✅ Embeddings found"
fi

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down..."
    if [ ! -z "$NGROK_PID" ]; then
        kill $NGROK_PID 2>/dev/null || true
    fi
    if [ ! -z "$API_PID" ]; then
        kill $API_PID 2>/dev/null || true
    fi
    exit 0
}
trap cleanup SIGINT SIGTERM

# Start the API server in the background
echo "🌐 Starting API server..."
cd /Users/kevinruan/Downloads/lamplight-ai-agent/agents/schema-agent

# Start API server and capture output
echo "🔄 Starting API server process..."
python run_api_simple.py > api_server.log 2>&1 &
API_PID=$!

# Wait longer for API server to fully load (embeddings take time)
echo "⏳ Waiting for API server to load (this may take 30-60 seconds)..."
sleep 5

# Check if process is still running
if ! ps -p $API_PID > /dev/null 2>&1; then
    echo "❌ API server process died. Check logs:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    tail -20 api_server.log
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit 1
fi

# Wait for HTTP endpoint to be ready with retries
MAX_RETRIES=12
RETRY_COUNT=0
echo "🔍 Checking if API endpoint is ready..."

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:8000/health >/dev/null 2>&1; then
        echo "✅ API server is ready!"
        break
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "   Attempt $RETRY_COUNT/$MAX_RETRIES - waiting 5 seconds..."
    sleep 5
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "❌ API server failed to respond after $((MAX_RETRIES * 5)) seconds"
    echo "📋 Last few log lines:"
    tail -10 api_server.log
    kill $API_PID 2>/dev/null || true
    exit 1
fi

echo "✅ API server started successfully"

# Start ngrok tunnel with static domain
echo "🌍 Starting ngrok tunnel with static domain..."
ngrok http --domain=labrador-precious-firmly.ngrok-free.app 8000 --log=stdout &
NGROK_PID=$!

# Wait a moment for ngrok to start
sleep 3

# Get the ngrok public URL
echo ""
echo "🎉 Server is running!"
echo "======================================"
echo "Local URL:  http://localhost:8000"
echo "Health:     http://localhost:8000/health"
echo "Stats:      http://localhost:8000/stats"
echo "Chat API:   POST http://localhost:8000/chat"
echo "Chat Stream: POST http://localhost:8000/chat/stream"
echo ""
# Static domain URL
NGROK_URL="https://labrador-precious-firmly.ngrok-free.app"

echo "🌍 Static Public URL: $NGROK_URL"
echo "🌍 Public API: $NGROK_URL/chat"
echo "🌍 Health Check: $NGROK_URL/health"
echo "🌍 Stats: $NGROK_URL/stats"
echo ""
echo "📋 Example curl command:"
echo "curl -X POST '$NGROK_URL/chat' \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"question\": \"How do I create a user?\"}'"

echo ""
echo "🔄 Server is running... Press Ctrl+C to stop"

# Keep the script running
wait $API_PID