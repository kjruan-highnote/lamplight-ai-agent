# GraphQL Schema QA API - Local Setup with ngrok

This guide will help you set up and run the GraphQL Schema QA API locally and make it accessible over the internet using ngrok.

## Prerequisites

1. **Python 3.11+** with the packages in `requirements.txt`
2. **Ollama** with the `llama3` model installed
3. **ngrok** for exposing the API to the internet

### Install Prerequisites

```bash
# Install Ollama (macOS)
brew install ollama

# Start Ollama service
ollama serve

# Install llama3 model
ollama pull llama3

# Install ngrok (macOS) 
brew install ngrok

# Install Python dependencies
pip install -r requirements.txt
```

## Quick Start

The easiest way to get started is using the provided startup script:

```bash
# Make sure you're in the schema-agent directory
cd /path/to/schema-agent

# Run the startup script (handles everything automatically)
./start_server.sh
```

The script will:
- ✅ Check that Ollama and ngrok are installed
- ✅ Verify that the `llama3` model is available
- ✅ Create embeddings if they don't exist (this may take a few minutes)
- ✅ Start the API server on localhost:8000
- ✅ Start ngrok tunnel for public access
- ✅ Display both local and public URLs

## Manual Setup

If you prefer to run things manually:

### 1. Create Embeddings (if not already done)

```bash
python -m agent.embedder --chunks chunks --out_index embeddings/index.faiss --out_meta embeddings/metadata.json
```

### 2. Start the API Server

```bash
# Option 1: Using the API module directly
python -m agent.api

# Option 2: Using uvicorn explicitly  
uvicorn agent.api:app --host 0.0.0.0 --port 8000

# Option 3: Using the provided run script
./run-api.sh
```

### 3. Start ngrok (in another terminal)

```bash
# Create public tunnel to your local API
ngrok http 8000
```

## Testing the API

Once running, you can test the API:

### Local Testing

```bash
# Health check
curl http://localhost:8000/health

# Ask a question
curl -X POST http://localhost:8000/chat \
     -H "Content-Type: application/json" \
     -d '{"question": "How do I create a user account?"}'

# Get retriever statistics  
curl http://localhost:8000/stats
```

### Public Testing (via ngrok)

Replace `https://xxxx-xx-xx-xxx-xxx.ngrok-free.app` with your actual ngrok URL:

```bash
# Health check
curl https://xxxx-xx-xx-xxx-xxx.ngrok-free.app/health

# Ask a question
curl -X POST https://xxxx-xx-xx-xxx-xxx.ngrok-free.app/chat \
     -H "Content-Type: application/json" \
     -d '{"question": "How do I create a user account?"}'
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check and status |
| `/stats` | GET | Retriever statistics |
| `/chat` | POST | Ask questions about GraphQL schema |
| `/chat/stream` | POST | Streaming responses (implemented) |

### Example Request Body

```json
{
  "question": "How do I create a user account?",
  "top_k": 5
}
```

### Example Response

```json
{
  "response": "To create a user account, you can use the createUSPersonAccountHolder mutation...",
  "metadata": {
    "top_k": 5,
    "question_length": 32
  },
  "processing_time_ms": 1250.5
}
```

## Configuration

The API uses environment variables for configuration. See `.env` file:

- `ENABLE_AUTH=false` - No authentication required
- `ALLOWED_ORIGINS=*` - Allow requests from any origin
- `HOST=0.0.0.0` - Listen on all interfaces
- `PORT=8000` - API server port

## Troubleshooting

### Common Issues

1. **"Ollama API call failed"**
   - Ensure Ollama is running: `ollama serve`
   - Check if model exists: `ollama list`
   - Install model: `ollama pull llama3`

2. **"FAISS index not loaded"**
   - Run: `python -m agent.embedder --chunks chunks`
   - Verify files exist: `ls embeddings/`

3. **"ngrok not found"**
   - Install ngrok: `brew install ngrok`
   - Or download from: https://ngrok.com/download

4. **Rate limiting errors**
   - Wait a moment between requests
   - Current limits: 30/min for chat, 10/min for other endpoints

### Logs

Check the console output for detailed logs. The API provides structured logging with timestamps.

## Security Notes

- **No authentication** is enabled by default for easy testing
- **CORS is open** to allow requests from any origin  
- For production use, set `ENABLE_AUTH=true` and configure proper CORS origins

## Next Steps

- Try asking questions about your GraphQL schema
- Experiment with different `top_k` values for retrieval
- Build a frontend that consumes this API
- Add authentication for production use