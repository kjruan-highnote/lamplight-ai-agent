#!/bin/bash

# Start Generator Service
# This script starts the Python generator service that handles document generation

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Starting Generator Service..."

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "Python 3 is not installed. Please install Python 3 to continue."
    exit 1
fi

# Check if FastAPI is installed
if ! python3 -c "import fastapi" &> /dev/null 2>&1; then
    echo "FastAPI is not installed. Installing..."
    pip3 install fastapi uvicorn pydantic pyyaml jinja2
fi

# Navigate to src directory
cd "$PROJECT_DIR/src"

# Set environment variables
export GENERATOR_SERVICE_PORT=${GENERATOR_SERVICE_PORT:-8001}
export MONGODB_URI=${MONGODB_URI:-"mongodb://localhost:27017"}
export MONGODB_DB=${MONGODB_DB:-"geck"}

# Start the service
echo "Starting generator service on port $GENERATOR_SERVICE_PORT..."
python3 generator_service.py

# Keep the script running
wait