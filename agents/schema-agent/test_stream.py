#!/usr/bin/env python3
"""
Test streaming endpoint
"""

import requests
import json

API_BASE = "http://localhost:8000"

def test_streaming():
    print("Testing streaming endpoint")
    print("=" * 30)
    
    payload = {
        "question": "What is the ping query?",
        "top_k": 3
    }
    
    try:
        print("Sending streaming request...")
        response = requests.post(
            f"{API_BASE}/chat/stream",
            json=payload,
            stream=True,
            timeout=60
        )
        
        print(f"Response status: {response.status_code}")
        print(f"Response headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            print("Streaming response:")
            print("-" * 20)
            
            for chunk in response.iter_lines():
                if chunk:
                    decoded_chunk = chunk.decode('utf-8')
                    print(f"Chunk: {decoded_chunk}")
                    if "[DONE]" in decoded_chunk:
                        break
                        
        else:
            print(f"Error response: {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_streaming()