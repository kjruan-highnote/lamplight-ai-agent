#!/usr/bin/env python3
"""
Quick API test script
"""

import requests
import json
import time

API_BASE = "http://localhost:8000"

def test_api():
    """Test the API endpoints"""
    
    print("Testing GraphQL Schema QA API")
    print("=" * 40)
    
    # Test health endpoint
    print("1. Testing health endpoint...")
    try:
        response = requests.get(f"{API_BASE}/health", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"   Health: {data['status']}")
            print(f"   Agent ready: {data['agent_ready']}")
        else:
            print(f"   Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"   Health check failed: {e}")
        return False
    
    # Test stats endpoint
    print("\n2. Testing stats endpoint...")
    try:
        response = requests.get(f"{API_BASE}/stats", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"   Total chunks: {data.get('total_chunks', 'unknown')}")
            print(f"   Status: {data.get('status', 'unknown')}")
        else:
            print(f"   Stats failed: {response.status_code}")
    except Exception as e:
        print(f"   Stats failed: {e}")
    
    # Test chat endpoint
    print("\n3. Testing chat endpoint...")
    try:
        payload = {
            "question": "What is the ping query?",
            "top_k": 3
        }
        response = requests.post(
            f"{API_BASE}/chat", 
            json=payload, 
            timeout=30
        )
        if response.status_code == 200:
            data = response.json()
            print(f"   Response received ({len(data['response'])} chars)")
            print(f"   Processing time: {data['processing_time_ms']:.1f}ms")
            print(f"   Answer preview: {data['response'][:100]}...")
        else:
            print(f"   Chat failed: {response.status_code}")
            print(f"   Error: {response.text}")
    except Exception as e:
        print(f"   Chat failed: {e}")
    
    print("\nAPI test completed!")
    return True

if __name__ == "__main__":
    test_api()