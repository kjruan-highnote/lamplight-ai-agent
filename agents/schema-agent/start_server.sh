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
python -m agent.api &
API_PID=$!

# Wait for API server to start
sleep 3

# Check if API server is running
if ! curl -s http://localhost:8000/health >/dev/null 2>&1; then
    echo "❌ API server failed to start"
    kill $API_PID 2>/dev/null || true
    exit 1
fi

echo "✅ API server started successfully"

# Start ngrok tunnel
echo "🌍 Starting ngrok tunnel..."
ngrok http 8000 --log=stdout &
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
echo ""
echo "📡 Getting ngrok public URL..."

# Try to get ngrok URL from API
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for tunnel in data.get('tunnels', []):
        if tunnel.get('proto') == 'https':
            print(tunnel['public_url'])
            break
except:
    pass
" 2>/dev/null)

if [ ! -z "$NGROK_URL" ]; then
    echo "🌍 Public URL: $NGROK_URL"
    echo "🌍 Public API: $NGROK_URL/chat"
    echo ""
    echo "📋 Example curl command:"
    echo "curl -X POST '$NGROK_URL/chat' \\"
    echo "     -H 'Content-Type: application/json' \\"
    echo "     -d '{\"question\": \"How do I create a user?\"}'"
else
    echo "⚠️  Could not retrieve ngrok URL automatically"
    echo "   Check ngrok dashboard: http://localhost:4040"
fi

echo ""
echo "🔄 Server is running... Press Ctrl+C to stop"

# Keep the script running
wait $API_PID