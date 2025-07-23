#!/usr/bin/env python3
"""
Debug similarity scores
"""

import sys
from pathlib import Path

# Add the current directory to Python path
current_dir = Path(__file__).parent.absolute()
sys.path.insert(0, str(current_dir))

from agent.embedder import Embedder

def test_scores():
    print("Testing similarity scores")
    print("=" * 30)
    
    try:
        # Initialize embedder directly
        embedder = Embedder(model_name="BAAI/bge-base-en-v1.5")
        embedder.load("embeddings/index.faiss", "embeddings/metadata.json")
        
        # Test search_with_scores method
        question = "ping"
        print(f"Testing question: {question}")
        
        # Try the new search_with_scores method
        try:
            results = embedder.search_with_scores(question, top_k=5)
            print(f"search_with_scores results: {len(results)}")
            
            for i, (path, content, score) in enumerate(results[:3]):
                print(f"  {i+1}. {Path(path).name}")
                print(f"     Score: {score}")
                print(f"     Content: {content[:50]}...")
                print()
                
        except Exception as e:
            print(f"search_with_scores failed: {e}")
            
            # Try regular search
            regular_results = embedder.search(question, top_k=5)
            print(f"Regular search results: {len(regular_results)}")
            
            for i, (path, content) in enumerate(regular_results[:3]):
                print(f"  {i+1}. {Path(path).name}")
                print(f"     Content: {content[:50]}...")
                print()
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_scores()