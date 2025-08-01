# Advisory Agent

Intelligent routing agent that directs queries to the appropriate specialist agents (schema-agent or document-agent) and combines their responses.

## Architecture

```
User Query → Advisory Agent → Router → [Schema Agent | Document Agent | Both]
                ↓
            Response Combiner → Unified Response
```

## Features

- **Smart Query Classification**: Determines whether queries are about GraphQL schema, documentation, or both
- **Multi-Agent Coordination**: Can query both agents simultaneously for comprehensive answers
- **Response Synthesis**: Combines responses from multiple agents into coherent answers
- **Unified API**: Single endpoint for all Highnote questions
- **Fallback Logic**: Routes to both agents if classification is uncertain

## Query Types

- **Schema Queries**: GraphQL types, mutations, field definitions
- **Documentation Queries**: Implementation guides, tutorials, concepts
- **Mixed Queries**: Questions requiring both schema knowledge and documentation

## Setup

1. Ensure both schema-agent and document-agent are running:
   ```bash
   # Schema agent on :8000
   cd ../schema-agent && python src/api.py &
   
   # Document agent on :8001  
   cd ../document-agent && PYTHONPATH=. python src/api.py &
   ```

2. Install and start advisory agent:
   ```bash
   pip install -e .
   python src/api.py  # Runs on :8002
   ```

## Usage

```bash
# Ask any Highnote question
curl -X POST "http://localhost:8002/chat" \
  -H "Content-Type: application/json" \
  -d '{"question": "How do I create a card product and what GraphQL mutations do I need?"}'
```