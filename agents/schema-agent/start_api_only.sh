#!/bin/bash

# Simple API-only startup script (no ngrok)
set -e

echo "🚀 Starting GraphQL Schema QA API (Local Only)"
echo "=============================================="

# Check if Ollama is running
if ! curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
    echo "❌ Ollama is not running. Please start Ollama first:"
    echo "   ollama serve"
    exit 1
fi

# Set environment variables for no-auth setup
export ENABLE_AUTH=false
export ALLOWED_ORIGINS="*"
export HOST=0.0.0.0
export PORT=8000

echo "✅ Environment configured (no authentication)"

# Navigate to project directory
cd "$(dirname "$0")"

echo "🌐 Starting API server..."
echo "⏳ This may take 10-15 seconds to load the embedding model..."
echo ""

# Start the API server
python debug_api.py