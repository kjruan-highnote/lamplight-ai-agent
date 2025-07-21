#!/bin/bash

set -e

SCHEMA_PATH="schema/highnote.graphql"
CHUNKS_DIR="chunks"
QUERY="How do I create a user?"
MODEL="llama3"  # Change if you're using a different local Ollama model

echo "Step 1: Chunking schema..."
python agent/chunker.py --schema "$SCHEMA_PATH" --out "$CHUNKS_DIR"

echo "Step 2: Embedding chunks..."
python agent/embedder.py --chunks "$CHUNKS_DIR" --force

echo "Step 3: Asking the agent: \"$QUERY\""
python main.py --question "$QUERY" --model "$MODEL"