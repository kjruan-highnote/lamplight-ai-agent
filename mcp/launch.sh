#!/bin/bash
# Launch Lamplight MCP Server

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "=========================================="
echo "   Lamplight Data MCP Server"
echo "=========================================="
echo ""
echo -e "${GREEN}Features:${NC}"
echo "  • Fast, structured data access"
echo "  • No LLM calls - instant responses"
echo "  • GraphQL schema search & details"
echo "  • Documentation search"
echo "  • Program configurations"
echo ""

# Check data availability
echo -e "${BLUE}Data Sources:${NC}"

SCHEMA_FILE="$SCRIPT_DIR/../agents/schema-agent/schema/highnote.graphql"
if [ -f "$SCHEMA_FILE" ]; then
    TYPES=$(grep -c "^type " "$SCHEMA_FILE" 2>/dev/null || echo "0")
    echo -e "  ${GREEN}✅${NC} GraphQL Schema: $TYPES types found"
else
    echo -e "  ${RED}❌${NC} GraphQL Schema: Not found"
fi

DOC_DIR="$SCRIPT_DIR/../agents/document-agent/data/chunks"
if [ -d "$DOC_DIR" ]; then
    CHUNKS=$(ls "$DOC_DIR"/chunk_*.txt 2>/dev/null | wc -l | tr -d ' ')
    echo -e "  ${GREEN}✅${NC} Documentation: $CHUNKS chunks available"
else
    echo -e "  ${RED}❌${NC} Documentation: Chunks directory not found"
fi

echo ""
echo -e "${YELLOW}Testing Options:${NC}"
echo ""
echo "1. MCP Inspector (recommended for testing):"
echo "   npx @modelcontextprotocol/inspector python -m src.data_server"
echo ""
echo "2. Claude Desktop:"
echo "   Already configured in claude_config.json as 'lamplight-data'"
echo ""
echo "3. Direct Python test:"
echo "   python test_data_server.py"
echo ""

echo -e "${GREEN}Available Tools:${NC}"
echo "  • search_schema_types - Search GraphQL types"
echo "  • get_type_details - Get complete type information"
echo "  • search_operations - Find queries and mutations"
echo "  • search_documentation - Search documentation"
echo "  • list_programs - List all programs"
echo "  • get_program_details - Get program configuration"
echo "  • get_statistics - Get data statistics"
echo ""

echo "=========================================="
echo ""
echo "Starting server..."
echo ""

cd "$SCRIPT_DIR"
python -m src.data_server