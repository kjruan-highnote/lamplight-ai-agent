#!/usr/bin/env python
"""Test MCP server components directly"""

import asyncio
import json
from pathlib import Path
import sys

# Add src to path
sys.path.insert(0, str(Path(__file__).parent))

from src.knowledge_base import UnifiedKnowledgeBase
from src.llm_manager import LLMManager
from src.query_classifier import QueryClassifier
from src.tools import SchemaTools, DocumentationTools, SolutionsTools

async def test_components():
    """Test individual components"""
    
    print("Testing MCP Server Components\n" + "="*50)
    
    # Load config
    config_path = Path(__file__).parent / "config" / "server_config.json"
    with open(config_path) as f:
        config = json.load(f)
    
    # Test 1: Knowledge Base
    print("\n1. Testing Knowledge Base...")
    try:
        kb = UnifiedKnowledgeBase(config)
        print(f"   ✓ Knowledge base loaded with {kb.index.ntotal} vectors")
        
        # Test search
        results = await kb.search("payment card", k=3)
        print(f"   ✓ Search test: Found {len(results)} results for 'payment card'")
        if results:
            print(f"      Top result: {results[0].content[:100]}...")
    except Exception as e:
        print(f"   ✗ Knowledge base error: {e}")
    
    # Test 2: Query Classifier
    print("\n2. Testing Query Classifier...")
    try:
        classifier = QueryClassifier()
        
        test_queries = [
            "What fields does PaymentCard have?",
            "How do I implement webhooks?",
            "Generate a collection for consumer credit",
            "What are the best practices for error handling?"
        ]
        
        for query in test_queries:
            query_type = await classifier.classify(query)
            print(f"   ✓ '{query[:40]}...' → {query_type.value}")
    except Exception as e:
        print(f"   ✗ Classifier error: {e}")
    
    # Test 3: LLM Manager (without actual LLM call)
    print("\n3. Testing LLM Manager...")
    try:
        llm = LLMManager(config)
        print("   ✓ LLM Manager initialized")
        print(f"   ✓ Model: {llm.config.model}")
        print(f"   ✓ API Base: {llm.config.api_base}")
    except Exception as e:
        print(f"   ✗ LLM Manager error: {e}")
    
    # Test 4: Tools
    print("\n4. Testing Tools...")
    try:
        schema_tools = SchemaTools(kb, llm)
        doc_tools = DocumentationTools(kb, llm)
        solutions_tools = SolutionsTools(kb, llm)
        
        print("   ✓ SchemaTools initialized")
        print("   ✓ DocumentationTools initialized")
        print("   ✓ SolutionsTools initialized")
        
        # Test listing programs
        programs = await solutions_tools.list_programs()
        print(f"   ✓ Found {len(programs)} programs:")
        for p in programs[:3]:
            print(f"      - {p['name']}")
    except Exception as e:
        print(f"   ✗ Tools error: {e}")
    
    print("\n" + "="*50)
    print("Component testing complete!")
    
    # Test 5: Quick query test
    print("\n5. Testing actual query (without LLM)...")
    try:
        query = "How to create a payment card"
        results = await kb.search(query, k=3)
        
        print(f"   Query: '{query}'")
        print(f"   Found {len(results)} relevant chunks:")
        for i, r in enumerate(results, 1):
            print(f"   {i}. Score: {r.score:.3f}, Namespace: {r.namespace.value}")
            print(f"      Preview: {r.content[:100]}...")
    except Exception as e:
        print(f"   ✗ Query test error: {e}")

if __name__ == "__main__":
    asyncio.run(test_components())