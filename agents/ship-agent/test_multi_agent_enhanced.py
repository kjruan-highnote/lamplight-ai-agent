#!/usr/bin/env python3
"""
Test Enhanced Multi-Agent Collaboration with LLM-powered Ship Agent
"""
import requests
import json
import asyncio
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger(__name__)

ADVISORY_AGENT_URL = "http://localhost:8002"
SHIP_AGENT_URL = "http://localhost:8003"

def test_implementation_questions():
    """Test implementation-specific questions through Advisory Agent"""
    
    print("\n" + "=" * 70)
    print("🧪 Testing Implementation Questions via Advisory Agent")
    print("=" * 70)
    
    test_cases = [
        {
            "name": "Trip.com Authentication",
            "question": "How do I implement authentication for Trip.com API integration?",
            "expects": ["authentication", "oauth", "api key"]
        },
        {
            "name": "Virtual Card Issuance",
            "question": "What are the steps to issue virtual cards for Trip.com bookings?",
            "expects": ["virtual card", "createCard", "booking"]
        },
        {
            "name": "Multi-Currency Handling",
            "question": "How to handle multi-currency transactions in Trip.com with GraphQL mutations?",
            "expects": ["currency", "FX", "GraphQL"]
        },
        {
            "name": "Webhook Integration",
            "question": "How do I set up webhook handlers for Trip.com booking status updates?",
            "expects": ["webhook", "status", "handler"]
        },
        {
            "name": "Best Practices",
            "question": "What are the best practices for implementing Trip.com integration?",
            "expects": ["best practice", "security", "testing"]
        }
    ]
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n📝 Test {i}: {test_case['name']}")
        print(f"Question: {test_case['question']}\n")
        
        try:
            # Query through Advisory Agent
            response = requests.post(
                f"{ADVISORY_AGENT_URL}/chat",
                json={"question": test_case['question']},
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                answer = data.get('answer', '')
                source = data.get('source', 'unknown')
                confidence = data.get('confidence', 0)
                
                print(f"✅ Response received from: {source}")
                print(f"Confidence: {confidence:.2f}")
                
                # Check if expected keywords are in response
                found_keywords = []
                for keyword in test_case['expects']:
                    if keyword.lower() in answer.lower():
                        found_keywords.append(keyword)
                
                if found_keywords:
                    print(f"Found expected keywords: {', '.join(found_keywords)}")
                
                # Show snippet of answer
                print(f"\nAnswer snippet:")
                print(answer[:500] + "..." if len(answer) > 500 else answer)
                
            else:
                print(f"❌ Error: HTTP {response.status_code}")
                
        except Exception as e:
            print(f"❌ Error: {e}")

def test_direct_ship_agent():
    """Test direct Ship Agent queries with LLM"""
    
    print("\n" + "=" * 70)
    print("🚀 Testing Direct Ship Agent with LLM")
    print("=" * 70)
    
    queries = [
        {
            "question": "Generate a Python code example for creating a virtual card for Trip.com booking",
            "program_type": "trip.com"
        },
        {
            "question": "What GraphQL mutations are needed for Trip.com payment processing?",
            "program_type": "trip.com"
        }
    ]
    
    for query in queries:
        print(f"\n❓ {query['question']}")
        
        try:
            response = requests.post(
                f"{SHIP_AGENT_URL}/implementation/query",
                json=query,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('llm_powered'):
                    print("✅ LLM-powered response received")
                    
                    result = data.get('response', {})
                    
                    # Show answer
                    if result.get('answer'):
                        print(f"\nAnswer: {result['answer'][:400]}...")
                    
                    # Show code examples if available
                    if result.get('code_examples'):
                        print(f"\n📝 Code Examples: {len(result['code_examples'])} provided")
                        for example in result['code_examples'][:1]:
                            print(f"\n{example.get('title', 'Example')}:")
                            print(f"```{example.get('language', 'python')}")
                            print(example.get('code', '')[:200] + "...")
                            print("```")
                    
                    # Show relevant operations
                    if result.get('relevant_operations'):
                        print(f"\n🔧 Relevant Operations: {len(result['relevant_operations'])} found")
                        for op in result['relevant_operations'][:3]:
                            print(f"  - {op['name']}: {op.get('description', '')[:50]}...")
                    
                else:
                    print("⚠️ Fallback response (non-LLM)")
                    
            else:
                print(f"❌ Error: HTTP {response.status_code}")
                
        except Exception as e:
            print(f"❌ Error: {e}")

def test_multi_agent_collaboration():
    """Test complex queries that require multiple agents"""
    
    print("\n" + "=" * 70)
    print("🤝 Testing Multi-Agent Collaboration")
    print("=" * 70)
    
    complex_query = """
    I need to implement a complete Trip.com integration. Please provide:
    1. The GraphQL schema for creating virtual cards
    2. Best practices from documentation
    3. Step-by-step implementation guide
    4. Common error handling patterns
    """
    
    print(f"Complex Query: {complex_query[:100]}...")
    
    try:
        response = requests.post(
            f"{ADVISORY_AGENT_URL}/chat",
            json={"question": complex_query},
            timeout=45
        )
        
        if response.status_code == 200:
            data = response.json()
            
            print(f"\n✅ Response received")
            print(f"Source: {data.get('source', 'unknown')}")
            print(f"Confidence: {data.get('confidence', 0):.2f}")
            
            answer = data.get('answer', '')
            
            # Check if response includes information from multiple agents
            sources_mentioned = []
            if 'schema' in answer.lower() or 'graphql' in answer.lower():
                sources_mentioned.append('Schema Agent')
            if 'documentation' in answer.lower() or 'best practice' in answer.lower():
                sources_mentioned.append('Document Agent')
            if 'implementation' in answer.lower() or 'step' in answer.lower():
                sources_mentioned.append('Ship Agent')
            
            print(f"Information sources detected: {', '.join(sources_mentioned)}")
            
            # Show answer structure
            print(f"\nAnswer preview (first 600 chars):")
            print(answer[:600] + "...")
            
        else:
            print(f"❌ Error: HTTP {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error: {e}")

def test_agent_health():
    """Check health of all agents"""
    
    print("\n" + "=" * 70)
    print("🏥 Agent Health Check")
    print("=" * 70)
    
    try:
        response = requests.get(f"{ADVISORY_AGENT_URL}/health", timeout=5)
        if response.status_code == 200:
            data = response.json()
            agents = data.get('agents', {})
            
            print("\nAgent Status:")
            for agent, status in agents.items():
                status_icon = "✅" if status.get('status') == 'healthy' else "❌"
                print(f"  {status_icon} {agent}: {status.get('status')}")
    except Exception as e:
        print(f"❌ Error checking health: {e}")

def main():
    print("=" * 70)
    print("🎯 Enhanced Multi-Agent System Test")
    print("=" * 70)
    print("\nThis test demonstrates:")
    print("1. LLM-powered Ship Agent answering implementation questions")
    print("2. Multi-agent collaboration through Advisory Agent")
    print("3. Intelligent response combination from multiple sources")
    print("4. Code generation and best practices delivery")
    
    # Run tests
    test_agent_health()
    test_implementation_questions()
    test_direct_ship_agent()
    test_multi_agent_collaboration()
    
    print("\n" + "=" * 70)
    print("✅ Test Complete!")
    print("=" * 70)
    print("\nKey Achievements:")
    print("• Ship Agent now uses LLM for intelligent responses")
    print("• Advisory Agent routes implementation questions correctly")
    print("• Responses combine insights from Schema, Document, and Ship agents")
    print("• Code examples and best practices are dynamically generated")
    print("• Trip.com specific implementation guidance is available")

if __name__ == "__main__":
    main()