#!/usr/bin/env python3
"""
Debug retrieval issues
"""

import sys
from pathlib import Path

# Add the current directory to Python path
current_dir = Path(__file__).parent.absolute()
sys.path.insert(0, str(current_dir))

from src.retriever import Retriever

def test_retrieval():
    print("Testing retrieval system")
    print("=" * 30)
    
    try:
        # Initialize retriever
        print("1. Initializing retriever...")
        retriever = Retriever()
        
        # Get stats
        stats = retriever.get_stats()
        print(f"   Stats: {stats}")
        
        # Test with simple question
        print("\n2. Testing simple retrieval...")
        question = "ping"
        results = retriever.retrieve_chunks(question, top_k=3)
        print(f"   Question: {question}")
        print(f"   Results count: {len(results)}")
        
        for i, result in enumerate(results[:3]):
            if len(result) == 3:  # (path, content, score)
                path, content, score = result
                print(f"   Result {i+1}: {Path(path).name} (score: {score:.3f})")
                print(f"   Content preview: {content[:100]}...")
            else:  # (path, content)
                path, content = result
                print(f"   Result {i+1}: {Path(path).name}")
                print(f"   Content preview: {content[:100]}...")
        
        # Test with GraphQL question
        print("\n3. Testing GraphQL question...")
        question = "What is the ping query?"
        results = retriever.retrieve_chunks(question, top_k=3)
        print(f"   Question: {question}")
        print(f"   Results count: {len(results)}")
        
        if results:
            print("   Success - found results!")
        else:
            print("   Problem - no results found")
            
        # Test the original embedder search method
        print("\n4. Testing embedder directly...")
        try:
            embedder_results = retriever.embedder.search("ping", top_k=3)
            print(f"   Direct embedder results: {len(embedder_results)}")
            for i, (path, content) in enumerate(embedder_results[:2]):
                print(f"   Result {i+1}: {Path(path).name}")
        except Exception as e:
            print(f"   Embedder error: {e}")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_retrieval()