import os
import json
import re
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

class DocumentChunker:
    """Chunks documentation content for optimal retrieval."""
    
    def __init__(self, 
                 max_chunk_size: int = 1000,
                 min_chunk_size: int = 100,
                 overlap_size: int = 200,
                 preserve_sections: bool = True):
        self.max_chunk_size = max_chunk_size
        self.min_chunk_size = min_chunk_size
        self.overlap_size = overlap_size
        self.preserve_sections = preserve_sections
    
    def clean_text(self, text: str) -> str:
        """Clean and normalize text content."""
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text)
        # Remove special characters but keep punctuation
        text = re.sub(r'[^\w\s\.\,\!\?\:\;\-\(\)\[\]\{\}\'\"\/]', '', text)
        return text.strip()
    
    def split_by_sentences(self, text: str) -> List[str]:
        """Split text into sentences for better chunking boundaries."""
        # Simple sentence splitting (can be enhanced with NLTK/spaCy)
        sentences = re.split(r'(?<=[.!?])\s+', text)
        return [s.strip() for s in sentences if s.strip()]
    
    def create_section_chunks(self, sections: List[Dict]) -> List[Dict]:
        """Create chunks from structured sections."""
        chunks = []
        
        for section in sections:
            heading = section.get('heading', '')
            content = section.get('content', '')
            level = section.get('level', 1)
            
            if not content.strip():
                continue
            
            # Clean content
            content = self.clean_text(content)
            
            # If section is small enough, keep as single chunk
            if len(content) <= self.max_chunk_size:
                chunks.append({
                    'content': f"{heading}\n\n{content}" if heading else content,
                    'heading': heading,
                    'level': level,
                    'chunk_type': 'section',
                    'size': len(content)
                })
            else:
                # Split large sections into smaller chunks
                sentences = self.split_by_sentences(content)
                current_chunk = ""
                
                for sentence in sentences:
                    # Check if adding this sentence would exceed max size
                    if len(current_chunk) + len(sentence) > self.max_chunk_size:
                        if current_chunk.strip():
                            chunks.append({
                                'content': f"{heading}\n\n{current_chunk}" if heading else current_chunk,
                                'heading': heading,
                                'level': level,
                                'chunk_type': 'section_part',
                                'size': len(current_chunk)
                            })
                        
                        # Start new chunk with overlap
                        if self.overlap_size > 0 and current_chunk:
                            overlap_words = current_chunk.split()[-self.overlap_size:]
                            current_chunk = ' '.join(overlap_words) + ' ' + sentence
                        else:
                            current_chunk = sentence
                    else:
                        current_chunk += ' ' + sentence if current_chunk else sentence
                
                # Add final chunk
                if current_chunk.strip():
                    chunks.append({
                        'content': f"{heading}\n\n{current_chunk}" if heading else current_chunk,
                        'heading': heading,
                        'level': level,
                        'chunk_type': 'section_part',
                        'size': len(current_chunk)
                    })
        
        return chunks
    
    def create_sliding_window_chunks(self, text: str) -> List[Dict]:
        """Create overlapping chunks using sliding window approach."""
        chunks = []
        text = self.clean_text(text)
        sentences = self.split_by_sentences(text)
        
        current_chunk = ""
        sentence_buffer = []
        
        for sentence in sentences:
            sentence_buffer.append(sentence)
            potential_chunk = ' '.join(sentence_buffer)
            
            if len(potential_chunk) > self.max_chunk_size:
                if current_chunk:
                    chunks.append({
                        'content': current_chunk,
                        'chunk_type': 'sliding_window',
                        'size': len(current_chunk)
                    })
                
                # Create new chunk with overlap
                overlap_sentences = max(1, self.overlap_size // 50)  # Rough estimate
                sentence_buffer = sentence_buffer[-overlap_sentences:]
                current_chunk = ' '.join(sentence_buffer)
            else:
                current_chunk = potential_chunk
        
        # Add final chunk
        if current_chunk.strip() and len(current_chunk) >= self.min_chunk_size:
            chunks.append({
                'content': current_chunk,
                'chunk_type': 'sliding_window',
                'size': len(current_chunk)
            })
        
        return chunks
    
    def chunk_document(self, doc: Dict) -> List[Dict]:
        """Chunk a single document based on its structure."""
        chunks = []
        
        # Extract metadata
        url = doc.get('url', '')
        title = doc.get('title', '')
        
        # Determine document category from URL
        category = self.categorize_document(url)
        
        # Try section-based chunking first if sections exist
        if self.preserve_sections and doc.get('sections'):
            section_chunks = self.create_section_chunks(doc['sections'])
            chunks.extend(section_chunks)
        else:
            # Fallback to sliding window chunking
            full_text = doc.get('full_text', '')
            if full_text:
                sliding_chunks = self.create_sliding_window_chunks(full_text)
                chunks.extend(sliding_chunks)
        
        # Add metadata to all chunks
        for i, chunk in enumerate(chunks):
            chunk.update({
                'doc_url': url,
                'doc_title': title,
                'doc_category': category,
                'chunk_id': f"{self.url_to_filename(url)}_{i}",
                'chunk_index': i
            })
        
        return chunks
    
    def categorize_document(self, url: str) -> str:
        """Categorize document based on URL path."""
        url_lower = url.lower()
        
        if '/docs/basics' in url_lower:
            return 'basics'
        elif '/docs/issuing' in url_lower:
            return 'issuing'
        elif '/docs/sdks' in url_lower:
            return 'sdks'
        elif '/docs/acquiring' in url_lower:
            return 'acquiring'
        elif '/docs/api' in url_lower:
            return 'api_reference'
        else:
            return 'general'
    
    def url_to_filename(self, url: str) -> str:
        """Convert URL to safe filename."""
        from urllib.parse import urlparse
        path = urlparse(url).path
        filename = path.replace('/docs/', '').replace('/', '_').strip('_')
        return filename if filename else 'root'
    
    def chunk_all_documents(self, docs: List[Dict]) -> List[Dict]:
        """Chunk all documents and return flattened list of chunks."""
        all_chunks = []
        
        for doc in docs:
            try:
                doc_chunks = self.chunk_document(doc)
                all_chunks.extend(doc_chunks)
                logger.info(f"Chunked {doc.get('url', 'unknown')}: {len(doc_chunks)} chunks")
            except Exception as e:
                logger.error(f"Error chunking document {doc.get('url', 'unknown')}: {e}")
        
        logger.info(f"Total chunks created: {len(all_chunks)}")
        return all_chunks
    
    def save_chunks(self, chunks: List[Dict], output_dir: str = "data/chunks"):
        """Save chunks to individual files and metadata."""
        os.makedirs(output_dir, exist_ok=True)
        
        # Save metadata
        metadata = []
        
        for i, chunk in enumerate(chunks):
            # Create filename
            chunk_filename = f"{chunk['chunk_id']}.txt"
            chunk_path = os.path.join(output_dir, chunk_filename)
            
            # Save chunk content
            with open(chunk_path, 'w') as f:
                f.write(f"Title: {chunk.get('doc_title', 'N/A')}\n")
                f.write(f"URL: {chunk.get('doc_url', 'N/A')}\n")
                f.write(f"Category: {chunk.get('doc_category', 'N/A')}\n")
                if chunk.get('heading'):
                    f.write(f"Section: {chunk['heading']}\n")
                f.write("=" * 50 + "\n\n")
                f.write(chunk['content'])
            
            # Add to metadata
            metadata.append({
                'chunk_id': chunk['chunk_id'],
                'file_path': chunk_path,
                'doc_url': chunk.get('doc_url'),
                'doc_title': chunk.get('doc_title'),
                'doc_category': chunk.get('doc_category'),
                'heading': chunk.get('heading'),
                'chunk_type': chunk.get('chunk_type'),
                'size': chunk.get('size'),
                'chunk_index': chunk.get('chunk_index')
            })
        
        # Save metadata
        metadata_path = os.path.join(output_dir, 'chunks_metadata.json')
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        logger.info(f"Saved {len(chunks)} chunks to {output_dir}")
        return metadata_path

if __name__ == "__main__":
    # Example usage
    chunker = DocumentChunker()
    
    # Load scraped docs
    with open('data/docs/scraped_docs.json', 'r') as f:
        docs = json.load(f)
    
    # Chunk documents
    chunks = chunker.chunk_all_documents(docs)
    
    # Save chunks
    chunker.save_chunks(chunks)