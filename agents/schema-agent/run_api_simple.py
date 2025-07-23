#!/usr/bin/env python3
"""
Simple API server startup script
"""

import os
import sys
from pathlib import Path

# Add the current directory to Python path
current_dir = Path(__file__).parent.absolute()
sys.path.insert(0, str(current_dir))

# Set environment variables for no auth
os.environ['ENABLE_AUTH'] = 'false'
os.environ['ALLOWED_ORIGINS'] = '*'
os.environ['HOST'] = '0.0.0.0'
os.environ['PORT'] = '8000'

# Import and run the API
if __name__ == "__main__":
    import uvicorn
    from agent.api import app
    
    print("🚀 Starting GraphQL Schema QA API")
    print("✅ No authentication required")
    print("🌐 Local URL: http://localhost:8000")
    print("📋 Health check: http://localhost:8000/health")
    print("💬 Chat API: POST http://localhost:8000/chat")
    print("")
    
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=8000,
        log_level="info"
    )