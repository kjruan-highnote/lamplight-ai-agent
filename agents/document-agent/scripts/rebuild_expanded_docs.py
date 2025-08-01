#!/usr/bin/env python3
"""
Script to rebuild document chunks and embeddings from expanded scraped documentation.
"""

import sys
import os
import json
from pathlib import Path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.doc_chunker import DocumentChunker
from src.simple_retriever import SimpleDocumentRetriever
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def main():
    # Paths
    docs_file = "data/docs/scraped_docs.json"
    chunks_dir = "data/chunks"
    
    # Step 1: Load scraped documentation
    logger.info("Loading scraped documentation...")
    if not os.path.exists(docs_file):
        logger.error(f"Scraped docs file not found: {docs_file}")
        logger.error("Run 'python src/web_scraper.py' first")
        return 1
    
    with open(docs_file, 'r') as f:
        docs = json.load(f)
    
    logger.info(f"Loaded {len(docs)} documents")
    
    # Step 2: Create chunks
    logger.info("Creating document chunks...")
    chunker = DocumentChunker(
        max_chunk_size=800,  # Smaller chunks for better retrieval
        min_chunk_size=50,
        overlap_size=100,
        preserve_sections=True
    )
    
    # Process all documents
    all_chunks = []
    for i, doc in enumerate(docs):
        logger.info(f"Processing document {i+1}/{len(docs)}: {doc.get('title', 'Untitled')}")
        
        if doc.get('sections'):
            # Use structured sections
            chunks = chunker.create_section_chunks(doc['sections'])
        else:
            # Fallback to full text
            chunks = chunker.create_sliding_window_chunks(doc.get('full_text', ''))
        
        # Add document metadata to each chunk
        for chunk in chunks:
            chunk['source_url'] = doc['url']
            chunk['source_title'] = doc.get('title', 'Untitled')
            chunk['doc_index'] = i
        
        all_chunks.extend(chunks)
    
    logger.info(f"Created {len(all_chunks)} total chunks")
    
    # Step 3: Save chunks to text files
    logger.info("Saving chunks as text files...")
    chunks_path = Path(chunks_dir)
    chunks_path.mkdir(exist_ok=True)
    
    # Clean existing chunk files
    for existing_file in chunks_path.glob("*.txt"):
        existing_file.unlink()
    
    # Save metadata
    metadata = []
    for i, chunk in enumerate(all_chunks):
        filename = f"chunk_{i:05d}.txt"
        filepath = chunks_path / filename
        
        # Write chunk content
        with open(filepath, 'w') as f:
            f.write(f"Title: {chunk.get('source_title', 'N/A')}\n")
            f.write(f"URL: {chunk.get('source_url', 'N/A')}\n")
            if chunk.get('heading'):
                f.write(f"Section: {chunk['heading']}\n")
            f.write("=" * 50 + "\n\n")
            f.write(chunk['content'])
        
        # Save metadata
        metadata.append({
            'file_path': str(filepath),
            'filename': filename,
            'source_url': chunk.get('source_url'),
            'source_title': chunk.get('source_title'),
            'heading': chunk.get('heading', ''),
            'chunk_type': chunk.get('chunk_type', 'unknown'),
            'size': chunk.get('size', len(chunk['content']))
        })
    
    # Save metadata file
    metadata_file = chunks_path / "chunks_metadata.json"
    with open(metadata_file, 'w') as f:
        json.dump(metadata, f, indent=2)
    
    logger.info(f"Saved {len(metadata)} chunks to {chunks_dir}")
    logger.info(f"Metadata saved to {metadata_file}")
    
    # Step 4: Build simple embeddings (in-memory with scikit-learn)
    logger.info("Building document retriever with embeddings...")
    retriever = SimpleDocumentRetriever(
        chunks_dir=chunks_dir,
        model_name="sentence-transformers/all-MiniLM-L6-v2"
    )
    
    logger.info("Rebuild complete!")
    logger.info(f"Document agent now has expanded knowledge base with {len(all_chunks)} chunks")
    
    # Test retrieval
    logger.info("Testing retrieval...")
    test_query = "How do I create a card product?"
    results = retriever.retrieve_chunks(test_query, top_k=3)
    logger.info(f"Test query: '{test_query}'")
    logger.info(f"Retrieved {len(results)} chunks")
    for i, (chunk, score) in enumerate(results[:2]):
        logger.info(f"  {i+1}. Score: {score:.3f}, Preview: {chunk[:100]}...")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())