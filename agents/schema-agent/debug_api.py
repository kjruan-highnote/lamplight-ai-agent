#!/usr/bin/env python3
"""
Debug API startup issues
"""

import sys
import os
from pathlib import Path

# Add the current directory to Python path
current_dir = Path(__file__).parent.absolute()
sys.path.insert(0, str(current_dir))

print("🔍 Debug API Startup")
print("=" * 30)

# Set environment variables
os.environ['ENABLE_AUTH'] = 'false'
os.environ['ALLOWED_ORIGINS'] = '*'

print("✅ Environment variables set")

# Test imports one by one
try:
    print("📦 Testing imports...")
    
    print("   - fastapi...", end="")
    import fastapi
    print(" ✅")
    
    print("   - uvicorn...", end="")
    import uvicorn
    print(" ✅")
    
    print("   - slowapi...", end="")
    import slowapi
    print(" ✅")
    
    print("   - ollama...", end="")
    import ollama
    print(" ✅")
    
    print("   - agent.llm_agent...", end="")
    from agent.llm_agent import LLMQA
    print(" ✅")
    
    print("   - agent.api...", end="")
    from agent.api import app
    print(" ✅")
    
except Exception as e:
    print(f" ❌ {e}")
    sys.exit(1)

print("\n🎯 Testing agent initialization...")
try:
    agent = LLMQA()
    print("✅ Agent initialized successfully")
    
    # Test retriever
    stats = agent.retriever.get_stats()
    print(f"✅ Retriever stats: {stats}")
    
except Exception as e:
    print(f"❌ Agent initialization failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n🌐 Testing Ollama connection...")
try:
    result = ollama.list()
    print(f"✅ Ollama response: {result}")
    
    models = []
    if 'models' in result:
        models = [model.get('name', 'unknown') for model in result['models']]
    
    print(f"✅ Available models: {models}")
    
    if not any('llama3' in model for model in models):
        print("⚠️  Warning: llama3 model not found. Install with: ollama pull llama3")
    else:
        print("✅ llama3 model is available")
    
except Exception as e:
    print(f"❌ Ollama connection failed: {e}")
    print("   Make sure Ollama is running: ollama serve")
    import traceback
    traceback.print_exc()

print("\n🚀 Starting API server...")
print("📍 The API will be available at: http://localhost:8000")
print("📍 Health check: http://localhost:8000/health")
print("📍 Press Ctrl+C to stop")
print("")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")