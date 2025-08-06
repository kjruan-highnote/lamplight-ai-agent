#!/usr/bin/env python
"""Debug why queries aren't returning results"""

import asyncio
import json
import logging
from pathlib import Path
import sys

# Setup logging
logging.basicConfig(level=logging.INFO)

# Add src to path
sys.path.insert(0, str(Path(__file__).parent))

from src.knowledge_base import UnifiedKnowledgeBase
from src.query_classifier import QueryClassifier, QueryType
from src.tools import SchemaTools, DocumentationTools
from src.llm_manager import LLMManager

async def debug_query(query: str):
    """Debug a specific query"""
    
    print(f"\n{'='*60}")
    print(f"DEBUGGING QUERY: '{query}'")
    print('='*60)
    
    # Load config
    config_path = Path(__file__).parent / "config" / "server_config.json"
    with open(config_path) as f:
        config = json.load(f)
    
    # Initialize components
    kb = UnifiedKnowledgeBase(config)
    classifier = QueryClassifier()
    llm = LLMManager(config)
    
    # Step 1: Classify query
    print("\n1. QUERY CLASSIFICATION:")
    print("-" * 40)
    query_type = await classifier.classify(query)
    analysis = await classifier.detailed_analysis(query)
    print(f"   Type: {query_type.value}")
    print(f"   Confidence: {analysis['confidence']:.3f}")
    print(f"   Scores: {json.dumps(analysis['scores'], indent=6)}")
    
    # Step 2: Direct search in knowledge base
    print("\n2. DIRECT KNOWLEDGE BASE SEARCH:")
    print("-" * 40)
    results = await kb.search(query, k=3)
    print(f"   Found {len(results)} results")
    for i, r in enumerate(results, 1):
        print(f"\n   Result {i}:")
        print(f"     Score: {r.score:.3f}")
        print(f"     Namespace: {r.namespace.value}")
        print(f"     Content preview: {r.content[:100]}...")
    
    # Step 3: Try schema tools
    print("\n3. SCHEMA TOOLS SEARCH:")
    print("-" * 40)
    schema_tools = SchemaTools(kb, llm)
    try:
        # Don't call LLM, just get search results
        schema_results = await kb.search_schema(query, k=3)
        print(f"   Found {len(schema_results)} schema results")
        for i, r in enumerate(schema_results, 1):
            print(f"     {i}. Score: {r.score:.3f}, Content: {r.content[:80]}...")
    except Exception as e:
        print(f"   Error: {e}")
    
    # Step 4: Try documentation tools
    print("\n4. DOCUMENTATION TOOLS SEARCH:")
    print("-" * 40)
    doc_tools = DocumentationTools(kb, llm)
    try:
        doc_results = await kb.search_docs(query, k=3)
        print(f"   Found {len(doc_results)} doc results")
        for i, r in enumerate(doc_results, 1):
            print(f"     {i}. Score: {r.score:.3f}, Content: {r.content[:80]}...")
    except Exception as e:
        print(f"   Error: {e}")
    
    # Step 5: Check if it's because of empty response filtering
    print("\n5. RESPONSE FILTERING CHECK:")
    print("-" * 40)
    if query_type in [QueryType.SCHEMA, QueryType.MIXED, QueryType.UNKNOWN]:
        print("   ✓ Query should route to schema tools")
    if query_type in [QueryType.DOCUMENTATION, QueryType.MIXED, QueryType.UNKNOWN]:
        print("   ✓ Query should route to documentation tools")
    
    print("\n" + "="*60)

async def main():
    # Test various queries
    test_queries = [
        "What is a payment card?",
        "PaymentCard fields",
        "How to create a payment card",
        "What are the fields in PaymentCard type?",
        "payment card",
    ]
    
    for query in test_queries:
        await debug_query(query)

if __name__ == "__main__":
    asyncio.run(main())