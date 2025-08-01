# Document Agent

AI-powered agent for answering questions about Highnote documentation.

## Architecture

- **Web Scraper**: Crawls https://highnote.com/docs
- **Document Chunker**: Semantic chunking by documentation sections
- **Embedder**: Creates vector embeddings for documentation content
- **Retriever**: FAISS-based similarity search
- **LLM Agent**: Ollama-based question answering
- **API**: FastAPI server with streaming support

## Setup

1. Install dependencies:
```bash
pip install -e .
```

2. Scrape documentation:
```bash
python scripts/scrape_docs.py
```

3. Build embeddings:
```bash
python scripts/build_embeddings.py
```

4. Start server:
```bash
python src/api.py
```

## Usage

```bash
curl -X POST "http://localhost:8001/chat" \
  -H "Content-Type: application/json" \
  -d '{"question": "How do I create a card product?"}'
```