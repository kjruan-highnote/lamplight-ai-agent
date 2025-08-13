#!/bin/bash

# Test script for ngrok-exposed advisory agent

set -e

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}Testing Ngrok Advisory Agent Setup${NC}"
echo "====================================="

# Get the ngrok domain from environment or argument
NGROK_DOMAIN=${1:-$NGROK_DOMAIN}

if [ -z "$NGROK_DOMAIN" ]; then
    echo "Usage: $0 <ngrok-domain>"
    echo "   or: export NGROK_DOMAIN=your-domain.ngrok-free.app"
    exit 1
fi

echo -e "Testing domain: ${BLUE}https://$NGROK_DOMAIN${NC}"
echo ""

# Test 1: Health check
echo -e "${YELLOW}Test 1: Health Check${NC}"
echo "---------------------"
curl -s "https://$NGROK_DOMAIN/health" | jq '.' || echo "Failed"
echo ""

# Test 2: Documentation query
echo -e "${YELLOW}Test 2: Documentation Query${NC}"
echo "---------------------------"
curl -s -X POST "https://$NGROK_DOMAIN/chat" \
  -H "Content-Type: application/json" \
  -d '{"question": "How do I create a card product?"}' | jq '.response' || echo "Failed"
echo ""

# Test 3: Schema query
echo -e "${YELLOW}Test 3: Schema Query${NC}"
echo "---------------------"
curl -s -X POST "https://$NGROK_DOMAIN/chat" \
  -H "Content-Type: application/json" \
  -d '{"question": "What mutations are available for card management?"}' | jq '.response' || echo "Failed"
echo ""

# Test 4: Mixed query
echo -e "${YELLOW}Test 4: Mixed Query${NC}"
echo "--------------------"
curl -s -X POST "https://$NGROK_DOMAIN/chat" \
  -H "Content-Type: application/json" \
  -d '{"question": "How do I use the createCardProduct mutation?", "force_both": true}' | jq '.response' || echo "Failed"
echo ""

echo -e "${GREEN}Tests complete!${NC}"