import os
import json
import faiss
import numpy as np
from pathlib import Path
from sentence_transformers import SentenceTransformer
from tqdm import tqdm
import logging

logger = logging.getLogger(__name__)

class DocumentEmbedder:
    """Creates embeddings for documentation chunks."""
    
    def __init__(self, 
                 model_name: str = "sentence-transformers/all-MiniLM-L6-v2",
                 batch_size: int = 16,
                 index_type: str = "flat",
                 nlist: int = 100):
        try:
            self.model = SentenceTransformer(model_name, trust_remote_code=True)
            logger.info(f"Loaded embedding model: {model_name}")
        except Exception as e:
            logger.error(f"Failed to load embedding model '{model_name}': {e}")
            raise SystemExit(1)
        
        self.index = None
        self.texts = []
        self.metadata = []
        self.batch_size = batch_size
        self.index_type = index_type
        self.nlist = nlist
    
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
    
    def create_enhanced_embeddings(self, texts: list, metadata: list) -> np.ndarray:
        """Create embeddings with documentation-specific enhancements."""
        all_embeddings = []
        
        for i in tqdm(range(0, len(texts), self.batch_size), desc="Creating embeddings"):
            batch_texts = texts[i:i + self.batch_size]
            batch_metadata = metadata[i:i + self.batch_size]
            
            # Create enhanced text for embedding
            enhanced_texts = []
            for text, meta in zip(batch_texts, batch_metadata):
                enhanced_text = self.enhance_text_for_embedding(text, meta)
                enhanced_texts.append(enhanced_text)
            
            # Generate embeddings
            batch_embeddings = self.model.encode(
                enhanced_texts,
                show_progress_bar=False,
                convert_to_numpy=True
            )
            all_embeddings.extend(batch_embeddings)
        
        return np.array(all_embeddings)
    
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
    
    def build_index(self, embeddings: np.ndarray):
        """Build FAISS index from embeddings."""
        dimension = embeddings.shape[1]
        logger.info(f"Building FAISS index with {len(embeddings)} vectors of dimension {dimension}")
        
        if self.index_type == "flat":
            self.index = faiss.IndexFlatL2(dimension)
        elif self.index_type == "ivf":
            quantizer = faiss.IndexFlatL2(dimension)
            self.index = faiss.IndexIVFFlat(quantizer, dimension, self.nlist)
            # Train the index
            self.index.train(embeddings)
        else:
            raise ValueError(f"Unsupported index type: {self.index_type}")
        
        # Add embeddings to index
        self.index.add(embeddings.astype(np.float32))
        logger.info(f"Index built successfully with {self.index.ntotal} vectors")
    
    def embed_and_index(self, chunks_dir: str, output_dir: str = "embeddings"):
        """Complete pipeline: load chunks, create embeddings, build index."""
        # Load chunks
        texts, metadata = self.load_chunks(chunks_dir)
        self.texts = texts
        self.metadata = metadata
        
        # Create embeddings
        embeddings = self.create_enhanced_embeddings(texts, metadata)
        
        # Build index
        self.build_index(embeddings)
        
        # Save everything
        self.save_index(output_dir)
        
        return len(texts)
    
    def save_index(self, output_dir: str):
        """Save FAISS index and metadata."""
        os.makedirs(output_dir, exist_ok=True)
        
        # Save FAISS index
        index_path = os.path.join(output_dir, "index.faiss")
        faiss.write_index(self.index, index_path)
        
        # Save metadata with texts
        metadata_with_texts = []
        for i, (text, meta) in enumerate(zip(self.texts, self.metadata)):
            combined_meta = meta.copy()
            combined_meta['text'] = text
            combined_meta['embedding_index'] = i
            metadata_with_texts.append(combined_meta)
        
        metadata_path = os.path.join(output_dir, "metadata.json")
        with open(metadata_path, 'w') as f:
            json.dump(metadata_with_texts, f, indent=2)
        
        logger.info(f"Saved index to {index_path}")
        logger.info(f"Saved metadata to {metadata_path}")
    
    def load_index(self, index_path: str, metadata_path: str):
        """Load existing FAISS index and metadata."""
        self.index = faiss.read_index(index_path)
        
        with open(metadata_path, 'r') as f:
            self.metadata = json.load(f)
        
        self.texts = [item['text'] for item in self.metadata]
        logger.info(f"Loaded index with {self.index.ntotal} vectors")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Create embeddings for documentation chunks")
    parser.add_argument("--chunks-dir", default="data/chunks", help="Directory containing chunks")
    parser.add_argument("--output-dir", default="embeddings", help="Output directory for index")
    parser.add_argument("--model", default="sentence-transformers/all-MiniLM-L6-v2", help="Embedding model")
    parser.add_argument("--batch-size", type=int, default=16, help="Batch size for embedding")
    
    args = parser.parse_args()
    
    embedder = DocumentEmbedder(
        model_name=args.model,
        batch_size=args.batch_size
    )
    
    num_chunks = embedder.embed_and_index(args.chunks_dir, args.output_dir)
    print(f"Successfully created embeddings for {num_chunks} chunks")