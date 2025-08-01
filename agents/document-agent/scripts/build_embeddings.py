#!/usr/bin/env python3
"""
Script to build embeddings from scraped documentation.
"""

import sys
import os
import json
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.doc_chunker import DocumentChunker
from src.embedder_chroma import DocumentEmbedder
import argparse
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def main():
    parser = argparse.ArgumentParser(description="Build embeddings from scraped documentation")
    parser.add_argument("--docs-file", default="data/docs/scraped_docs.json", help="Input scraped docs JSON file")
    parser.add_argument("--chunks-dir", default="data/chunks", help="Output directory for chunks")
    parser.add_argument("--embeddings-dir", default="embeddings", help="Output directory for embeddings")
    parser.add_argument("--model", default="sentence-transformers/all-MiniLM-L6-v2", help="Embedding model")
    parser.add_argument("--max-chunk-size", type=int, default=1000, help="Maximum chunk size")
    parser.add_argument("--skip-chunking", action="store_true", help="Skip chunking step (chunks already exist)")
    parser.add_argument("--skip-embedding", action="store_true", help="Skip embedding step (embeddings already exist)")
    
    args = parser.parse_args()
    
    # Step 1: Chunking
    if not args.skip_chunking:
        logger.info("Step 1: Chunking documents...")
        
        if not os.path.exists(args.docs_file):
            logger.error(f"Scraped docs file not found: {args.docs_file}")
            logger.error("Run 'python scripts/scrape_docs.py' first")
            return 1
        
        # Load scraped documents
        with open(args.docs_file, 'r') as f:
            docs = json.load(f)
        
        logger.info(f"Loaded {len(docs)} documents")
        
        # Create chunker and process documents
        chunker = DocumentChunker(
            max_chunk_size=args.max_chunk_size,
            preserve_sections=True
        )
        
        chunks = chunker.chunk_all_documents(docs)
        chunker.save_chunks(chunks, args.chunks_dir)
        
        logger.info(f"Created {len(chunks)} chunks")
    else:
        logger.info("Skipping chunking step")
    
    # Step 2: Embedding
    if not args.skip_embedding:
        logger.info("Step 2: Creating embeddings...")
        
        if not os.path.exists(args.chunks_dir):
            logger.error(f"Chunks directory not found: {args.chunks_dir}")
            logger.error("Run chunking step first or check directory path")
            return 1
        
        # Create embedder and build index
        embedder = DocumentEmbedder(
            model_name=args.model,
            persist_directory=args.embeddings_dir
        )
        
        num_chunks = embedder.embed_and_store(args.chunks_dir)
        logger.info(f"Created embeddings for {num_chunks} chunks")
    else:
        logger.info("Skipping embedding step")
    
    logger.info("Build complete!")
    logger.info(f"Chunks saved to: {args.chunks_dir}")
    logger.info(f"Embeddings saved to: {args.embeddings_dir}")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())