import os
import json
import numpy as np
from pathlib import Path
from sentence_transformers import SentenceTransformer
from typing import List, Dict, Any, Optional, Union
import logging

logger = logging.getLogger(__name__)

class DocumentEmbedder:
    """Handles document embedding using sentence transformers."""
    
    def __init__(self, model_name: str = "sentence-transformers/all-MiniLM-L6-v2"):
        """
        Initialize the document embedder.
        
        Args:
            model_name: Sentence transformer model to use for embeddings
        """
        self.model_name = model_name
        
        logger.info(f"Loading embedding model: {model_name}")
        self.model = SentenceTransformer(model_name, trust_remote_code=True)
        
    def embed_texts(self, texts: List[str], batch_size: int = 32, show_progress: bool = True) -> np.ndarray:
        """
        Create embeddings for a list of texts.
        
        Args:
            texts: List of text strings to embed
            batch_size: Batch size for processing
            show_progress: Whether to show progress bar
            
        Returns:
            Numpy array of embeddings with shape (n_texts, embedding_dim)
        """
        if not texts:
            return np.array([])
        
        logger.info(f"Creating embeddings for {len(texts)} texts")
        
        embeddings = self.model.encode(
            texts,
            batch_size=batch_size,
            show_progress_bar=show_progress,
            convert_to_numpy=True
        )
        
        logger.info(f"Created embeddings with shape: {embeddings.shape}")
        return embeddings
    
    def embed_single_text(self, text: str) -> np.ndarray:
        """
        Create embedding for a single text.
        
        Args:
            text: Text string to embed
            
        Returns:
            1D numpy array embedding
        """
        embedding = self.model.encode([text], convert_to_numpy=True)
        return embedding[0]  # Return 1D array
    
    def embed_from_chunks_directory(self, chunks_dir: str) -> tuple[List[str], np.ndarray, List[Dict[str, Any]]]:
        """
        Load chunks from directory and create embeddings.
        
        Args:
            chunks_dir: Directory containing chunk files and metadata
            
        Returns:
            Tuple of (texts, embeddings, metadata_list)
        """
        logger.info(f"Loading chunks from {chunks_dir}")
        
        chunks_path = Path(chunks_dir)
        metadata_file = chunks_path / "chunks_metadata.json"
        
        if not metadata_file.exists():
            raise FileNotFoundError(f"Metadata file not found: {metadata_file}")
        
        with open(metadata_file, 'r') as f:
            metadata_list = json.load(f)
        
        texts = []
        valid_metadata = []
        
        for meta in metadata_list:
            file_path = meta['file_path']
            if not os.path.exists(file_path):
                logger.warning(f"Chunk file not found: {file_path}")
                continue
            
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Extract content after header (skip metadata header)
                if "=" * 50 in content:
                    content = content.split("=" * 50, 1)[1].strip()
                
                if content:
                    texts.append(content)
                    valid_metadata.append(meta)
                    
            except Exception as e:
                logger.error(f"Error reading chunk {file_path}: {e}")
        
        logger.info(f"Loaded {len(texts)} valid chunks")
        
        # Create embeddings
        embeddings = self.embed_texts(texts)
        
        return texts, embeddings, valid_metadata
    
    def save_embeddings(self, embeddings: np.ndarray, texts: List[str], 
                       metadata_list: List[Dict[str, Any]], output_dir: str):
        """
        Save embeddings and associated data to directory.
        
        Args:
            embeddings: Numpy array of embeddings
            texts: List of text chunks
            metadata_list: List of metadata dictionaries
            output_dir: Directory to save to
        """
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        # Save embeddings as numpy array
        embeddings_file = output_path / "embeddings.npy"
        np.save(embeddings_file, embeddings)
        logger.info(f"Saved embeddings to {embeddings_file}")
        
        # Save associated data
        data = {
            'texts': texts,
            'metadata': metadata_list,
            'model_name': self.model_name,
            'embedding_dim': embeddings.shape[1],
            'total_chunks': len(texts)
        }
        
        data_file = output_path / "embedding_data.json"
        with open(data_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        logger.info(f"Saved embedding data to {data_file}")
    
    def load_embeddings(self, input_dir: str) -> tuple[np.ndarray, List[str], List[Dict[str, Any]]]:
        """
        Load embeddings and associated data from directory.
        
        Args:
            input_dir: Directory to load from
            
        Returns:
            Tuple of (embeddings, texts, metadata_list)
        """
        input_path = Path(input_dir)
        
        embeddings_file = input_path / "embeddings.npy"
        data_file = input_path / "embedding_data.json"
        
        if not (embeddings_file.exists() and data_file.exists()):
            raise FileNotFoundError(f"Embedding files not found in {input_path}")
        
        # Load embeddings
        embeddings = np.load(embeddings_file)
        
        # Load data
        with open(data_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        texts = data['texts']
        metadata_list = data['metadata']
        
        logger.info(f"Loaded embeddings with shape: {embeddings.shape}")
        logger.info(f"Model: {data.get('model_name', 'unknown')}")
        
        return embeddings, texts, metadata_list
    
    def get_embedding_dimension(self) -> int:
        """Get the embedding dimension of the model."""
        # Create a test embedding to get dimension
        test_embedding = self.embed_single_text("test")
        return test_embedding.shape[0]

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Document Embedder")
    parser.add_argument("--chunks-dir", required=True, help="Chunks directory")
    parser.add_argument("--output-dir", required=True, help="Output directory for embeddings")
    parser.add_argument("--model", default="sentence-transformers/all-MiniLM-L6-v2", help="Embedding model")
    
    args = parser.parse_args()
    
    # Set up logging
    logging.basicConfig(level=logging.INFO)
    
    embedder = DocumentEmbedder(model_name=args.model)
    
    # Load chunks and create embeddings
    texts, embeddings, metadata = embedder.embed_from_chunks_directory(args.chunks_dir)
    
    # Save embeddings
    embedder.save_embeddings(embeddings, texts, metadata, args.output_dir)
    
    print(f"Created and saved embeddings for {len(texts)} chunks")