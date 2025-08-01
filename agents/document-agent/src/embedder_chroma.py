import os
import json
import chromadb
from sentence_transformers import SentenceTransformer
from tqdm import tqdm
import logging
from pathlib import Path
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

class DocumentEmbedder:
    """Creates embeddings for documentation chunks using ChromaDB."""
    
    def __init__(self, 
                 model_name: str = "sentence-transformers/all-MiniLM-L6-v2",
                 collection_name: str = "highnote_docs",
                 persist_directory: str = "embeddings"):
        try:
            self.model = SentenceTransformer(model_name, trust_remote_code=True)
            logger.info(f"Loaded embedding model: {model_name}")
        except Exception as e:
            logger.error(f"Failed to load embedding model '{model_name}': {e}")
            raise SystemExit(1)
        
        # Initialize ChromaDB
        self.persist_directory = persist_directory
        self.collection_name = collection_name
        self.client = chromadb.PersistentClient(path=persist_directory)
        
        # Get or create collection
        try:
            self.collection = self.client.get_collection(collection_name)
            logger.info(f"Loaded existing collection: {collection_name}")
        except:
            self.collection = self.client.create_collection(
                name=collection_name,
                metadata={"description": "Highnote documentation chunks"}
            )
            logger.info(f"Created new collection: {collection_name}")
    
    def load_chunks(self, chunks_dir: str) -> tuple:
        """Load chunks and their metadata."""
        chunks_path = Path(chunks_dir)
        
        # Load metadata
        metadata_file = chunks_path / "chunks_metadata.json"
        if not metadata_file.exists():
            raise FileNotFoundError(f"Metadata file not found: {metadata_file}")
        
        with open(metadata_file, 'r') as f:
            metadata_list = json.load(f)
        
        texts = []
        valid_metadata = []
        
        for meta in tqdm(metadata_list, desc="Loading chunks"):
            file_path = meta['file_path']
            if not os.path.exists(file_path):
                logger.warning(f"Chunk file not found: {file_path}")
                continue
            
            try:
                with open(file_path, 'r') as f:
                    content = f.read()
                
                # Extract content after the metadata header
                if "=" * 50 in content:
                    content = content.split("=" * 50, 1)[1].strip()
                
                if content:
                    texts.append(content)
                    valid_metadata.append(meta)
                
            except Exception as e:
                logger.error(f"Error reading chunk {file_path}: {e}")
        
        logger.info(f"Loaded {len(texts)} valid chunks")
        return texts, valid_metadata
    
    def enhance_text_for_embedding(self, text: str, metadata: dict) -> str:
        """Enhance text with metadata for better embeddings."""
        enhanced_parts = []
        
        # Add category and title context
        if metadata.get('doc_category'):
            enhanced_parts.append(f"Category: {metadata['doc_category']}")
        
        if metadata.get('doc_title'):
            enhanced_parts.append(f"Page: {metadata['doc_title']}")
        
        if metadata.get('heading'):
            enhanced_parts.append(f"Section: {metadata['heading']}")
        
        # Add the main content
        enhanced_parts.append(text)
        
        return " | ".join(enhanced_parts)
    
    def embed_and_store(self, chunks_dir: str) -> int:
        """Complete pipeline: load chunks, create embeddings, store in ChromaDB."""
        # Load chunks
        texts, metadata = self.load_chunks(chunks_dir)
        
        # Clear existing data
        try:
            self.collection.delete()
            logger.info("Cleared existing collection")
        except:
            pass
        
        # Process in batches
        batch_size = 100
        total_stored = 0
        
        for i in tqdm(range(0, len(texts), batch_size), desc="Processing batches"):
            batch_texts = texts[i:i + batch_size]
            batch_metadata = metadata[i:i + batch_size]
            
            # Create enhanced texts for embedding
            enhanced_texts = []
            for text, meta in zip(batch_texts, batch_metadata):
                enhanced_text = self.enhance_text_for_embedding(text, meta)
                enhanced_texts.append(enhanced_text)
            
            # Create embeddings
            embeddings = self.model.encode(enhanced_texts, convert_to_numpy=True)
            
            # Prepare data for ChromaDB
            ids = [f"chunk_{i + j}" for j in range(len(batch_texts))]
            documents = batch_texts  # Store original text, not enhanced
            metadatas = []
            
            for meta in batch_metadata:
                # ChromaDB metadata must be JSON serializable
                chroma_meta = {
                    'chunk_id': meta.get('chunk_id', ''),
                    'doc_url': meta.get('doc_url', ''),
                    'doc_title': meta.get('doc_title', ''),
                    'doc_category': meta.get('doc_category', ''),
                    'heading': meta.get('heading', ''),
                    'chunk_type': meta.get('chunk_type', ''),
                    'size': meta.get('size', 0),
                    'chunk_index': meta.get('chunk_index', 0)
                }
                metadatas.append(chroma_meta)
            
            # Add to collection
            self.collection.add(
                ids=ids,
                documents=documents,
                metadatas=metadatas,
                embeddings=embeddings.tolist()
            )
            
            total_stored += len(batch_texts)
        
        logger.info(f"Stored {total_stored} chunks in ChromaDB")
        return total_stored
    
    def get_collection_info(self) -> Dict[str, Any]:
        """Get information about the collection."""
        count = self.collection.count()
        return {
            'collection_name': self.collection_name,
            'total_documents': count,
            'persist_directory': self.persist_directory
        }

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Create embeddings for documentation chunks")
    parser.add_argument("--chunks-dir", default="data/chunks", help="Directory containing chunks")
    parser.add_argument("--persist-dir", default="embeddings", help="ChromaDB persist directory")
    parser.add_argument("--model", default="sentence-transformers/all-MiniLM-L6-v2", help="Embedding model")
    parser.add_argument("--collection", default="highnote_docs", help="Collection name")
    
    args = parser.parse_args()
    
    embedder = DocumentEmbedder(
        model_name=args.model,
        collection_name=args.collection,
        persist_directory=args.persist_dir
    )
    
    num_chunks = embedder.embed_and_store(args.chunks_dir)
    print(f"Successfully stored {num_chunks} chunks in ChromaDB")
    
    info = embedder.get_collection_info()
    print(f"Collection info: {info}")