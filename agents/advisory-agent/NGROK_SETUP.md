# Advisory Agent Ngrok Setup

This guide explains how to expose the Advisory Agent via ngrok while keeping the Schema and Document agents running locally.

## Prerequisites

1. **Ngrok Account**: Sign up at [ngrok.com](https://ngrok.com)
2. **Ngrok Auth Token**: Get from your [ngrok dashboard](https://dashboard.ngrok.com/auth)
3. **Named Domain**: One available ngrok domain (free tier includes 1)

## Quick Start

### 1. Set Environment Variables

```bash
export NGROK_AUTHTOKEN=your-auth-token-here
export NGROK_DOMAIN=your-domain.ngrok-free.app
```

### 2. Run with Single Command

Start all agents and expose advisory agent:

```bash
./run-with-ngrok.sh -d your-domain.ngrok-free.app -a
```

Or if you have the domain in environment:

```bash
./run-with-ngrok.sh -a
```

## Architecture

```
Internet
    ↓
[Ngrok Tunnel]
    ↓
[Advisory Agent :8002]
    ├── [Schema Agent :8000]   (internal localhost)
    └── [Document Agent :8001]  (internal localhost)
```

The Advisory Agent is exposed to the internet via ngrok, but it communicates with the Schema and Document agents using internal localhost connections. This means:

- Only one ngrok domain is needed
- Schema and Document agents remain secure and not exposed
- All inter-agent communication is fast and local

## Detailed Usage

### Starting Individual Components

If you want more control, you can start components individually:

1. **Start Schema Agent** (in schema-agent directory):
   ```bash
   python src/api.py
   ```

2. **Start Document Agent** (in document-agent directory):
   ```bash
   python src/api.py
   ```

3. **Start Advisory Agent with Ngrok**:
   ```bash
   ./run-with-ngrok.sh -d your-domain.ngrok-free.app
   ```

### Script Options

```bash
./run-with-ngrok.sh [OPTIONS]

OPTIONS:
    -d, --domain <domain>   Your ngrok domain (required)
    -a, --all               Start all three agents
    -v, --verbose           Show detailed output
    -h, --help              Show help message
```

### Testing the Setup

Once running, test with the provided script:

```bash
./test-ngrok.sh your-domain.ngrok-free.app
```

Or manually:

```bash
# Health check
curl https://your-domain.ngrok-free.app/health

# Ask a question
curl -X POST https://your-domain.ngrok-free.app/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "How do I create a card product?"}'
```

## API Endpoints

Once exposed via ngrok, the following endpoints are available:

- `https://your-domain.ngrok-free.app/health` - Health check
- `https://your-domain.ngrok-free.app/chat` - Chat endpoint
- `https://your-domain.ngrok-free.app/docs` - API documentation

### Chat Endpoint Parameters

```json
{
  "question": "Your question here",
  "top_k": 5,              // Optional: number of results (default: 5)
  "category": "issuing",   // Optional: category filter
  "force_both": false      // Optional: force both agents (default: false)
}
```

## Monitoring

### Ngrok Dashboard

View traffic and requests at: http://localhost:4040

### Logs

- Advisory Agent: `logs/advisory-agent.log`
- Document Agent: `../document-agent/logs/document-agent.log`
- Schema Agent: `../schema-agent/logs/schema-agent.log`
- Ngrok: `logs/ngrok.log`

## Security Considerations

1. **Authentication**: Add API key authentication if exposing to public:
   ```bash
   export ENABLE_AUTH=true
   export API_KEY=your-secure-api-key
   ```

2. **Rate Limiting**: The advisory agent includes rate limiting by default

3. **CORS**: Configure allowed origins:
   ```bash
   export ALLOWED_ORIGINS=https://your-app.com
   ```

## Troubleshooting

### Port Already in Use

If you see "address already in use" errors:

```bash
# Find and kill process on port
lsof -i :8002
kill -9 <PID>
```

### Ngrok Connection Failed

1. Check auth token is set correctly
2. Verify domain is available
3. Check ngrok status: http://localhost:4040

### Agents Not Responding

1. Check all agents are running:
   ```bash
   curl http://localhost:8000/health  # Schema
   curl http://localhost:8001/health  # Document
   curl http://localhost:8002/health  # Advisory
   ```

2. Check logs for errors

### Timeout Issues

If experiencing timeouts, the enhanced router includes:
- Automatic retry logic (2 retries)
- Connection pooling
- Optimized timeouts

## Advanced Configuration

### Using the Enhanced Router

To use the enhanced router with better error handling:

1. Update `api.py` to import the enhanced router:
   ```python
   from src.agent_router_enhanced import AgentRouter
   ```

2. The enhanced router includes:
   - Automatic localhost URL conversion
   - Retry logic for failed requests
   - Better connection pooling
   - Improved error messages

### Custom Domain Configuration

If you have a custom domain, update the ngrok config:

```yaml
tunnels:
  advisory-agent:
    proto: http
    addr: 8002
    domain: your-custom-domain.com
```

## Stopping Services

To stop all services cleanly:

1. Press `Ctrl+C` in the terminal running `run-with-ngrok.sh`
2. The script will automatically clean up all processes

Or manually:

```bash
# Kill ngrok
pkill -f ngrok

# Kill agents
kill $(cat logs/advisory-agent.pid)
kill $(cat ../document-agent/logs/document-agent.pid)
kill $(cat ../schema-agent/logs/schema-agent.pid)
```

## Integration Examples

### JavaScript/TypeScript

```typescript
const ADVISORY_API = 'https://your-domain.ngrok-free.app';

async function askQuestion(question: string) {
  const response = await fetch(`${ADVISORY_API}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ question }),
  });
  
  const data = await response.json();
  return data.response;
}

// Usage
const answer = await askQuestion('How do I create a card product?');
console.log(answer);
```

### Python

```python
import requests

ADVISORY_API = 'https://your-domain.ngrok-free.app'

def ask_question(question):
    response = requests.post(
        f'{ADVISORY_API}/chat',
        json={'question': question}
    )
    return response.json()['response']

# Usage
answer = ask_question('How do I create a card product?')
print(answer)
```

### cURL

```bash
curl -X POST https://your-domain.ngrok-free.app/chat \
  -H "Content-Type: application/json" \
  -d '{
    "question": "How do I create a card product?",
    "top_k": 5,
    "force_both": false
  }'
```

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review logs in the `logs/` directory
3. Check ngrok dashboard at http://localhost:4040
4. Verify all agents are healthy using health endpoints