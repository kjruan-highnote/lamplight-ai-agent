#!/usr/bin/env python
"""
Build initial FAISS index from existing agent data

This script initializes the unified knowledge base by:
1. Loading data from all existing agents
2. Creating embeddings
3. Building FAISS index
4. Saving metadata
"""

import sys
import json
import logging
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.knowledge_base import UnifiedKnowledgeBase

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def main():
    """Build the unified index"""
    logger.info("Building unified FAISS index for MCP server...")
    
    # Load config
    config_path = Path(__file__).parent.parent / "config" / "server_config.json"
    with open(config_path) as f:
        config = json.load(f)
    
    # Initialize knowledge base (this will build the index)
    kb = UnifiedKnowledgeBase(config)
    
    # Save the index
    kb.save_index()
    
    logger.info("Index building complete!")
    logger.info(f"Total vectors indexed: {kb.index.ntotal}")
    logger.info(f"Total metadata entries: {len(kb.metadata)}")
    
    # Print namespace statistics
    namespace_stats = {}
    for chunk_id, metadata in kb.metadata.items():
        namespace = metadata.get("namespace", "unknown")
        namespace_stats[namespace] = namespace_stats.get(namespace, 0) + 1
    
    logger.info("\nNamespace statistics:")
    for namespace, count in namespace_stats.items():
        logger.info(f"  {namespace}: {count} chunks")

if __name__ == "__main__":
    main()