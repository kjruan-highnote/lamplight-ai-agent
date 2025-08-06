#!/bin/bash
# Launch Solutions MCP Server

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "=========================================="
echo "   Lamplight Solutions MCP Server"
echo "=========================================="
echo ""
echo -e "${GREEN}Features:${NC}"
echo "  • Complete program configurations"
echo "  • GraphQL operation templates"
echo "  • Solution brief generation"
echo "  • Sequence diagrams & ERDs"
echo "  • Postman collections"
echo ""

# Check data availability
echo -e "${BLUE}Data Sources:${NC}"

PROGRAMS_DIR="$SCRIPT_DIR/../agents/ship-agent/data/programs"
if [ -d "$PROGRAMS_DIR" ]; then
    PROGRAMS=$(ls "$PROGRAMS_DIR"/*.yaml 2>/dev/null | wc -l | tr -d ' ')
    echo -e "  ${GREEN}✅${NC} Program Configs: $PROGRAMS programs"
else
    echo -e "  ${RED}❌${NC} Program Configs: Directory not found"
fi

OPERATIONS_DIR="$SCRIPT_DIR/../agents/ship-agent/data/operations"
if [ -d "$OPERATIONS_DIR" ]; then
    OPERATIONS=$(ls "$OPERATIONS_DIR"/*_operations.json 2>/dev/null | wc -l | tr -d ' ')
    echo -e "  ${GREEN}✅${NC} Operations: $OPERATIONS programs with operations"
else
    echo -e "  ${RED}❌${NC} Operations: Directory not found"
fi

POSTMAN_DIR="$SCRIPT_DIR/../agents/ship-agent/data/postman"
if [ -d "$POSTMAN_DIR" ]; then
    COLLECTIONS=$(ls "$POSTMAN_DIR"/*.json 2>/dev/null | wc -l | tr -d ' ')
    echo -e "  ${GREEN}✅${NC} Postman Collections: $COLLECTIONS collections"
else
    echo -e "  ${YELLOW}⚠️${NC} Postman Collections: Directory not found (optional)"
fi

echo ""
echo -e "${YELLOW}Testing Options:${NC}"
echo ""
echo "1. MCP Inspector:"
echo "   npx @modelcontextprotocol/inspector python -m src.solutions_mcp_server"
echo ""
echo "2. Claude Desktop:"
echo "   Already configured as 'lamplight-solutions'"
echo ""
echo "3. Direct test:"
echo "   python test_solutions_server.py"
echo ""

echo -e "${GREEN}Available Tools:${NC}"
echo "  • list_programs - List all available programs"
echo "  • get_program_info - Get program configuration"
echo "  • find_operations - Search GraphQL operations"
echo "  • get_operation_details - Get full operation details"
echo "  • generate_sequence_diagram - Create workflow diagrams"
echo "  • generate_erd - Create entity relationship diagrams"
echo "  • generate_solution_brief - Generate complete solution brief"
echo "  • get_postman_collection - Get Postman collections"
echo ""

echo -e "${BLUE}Example Use Cases:${NC}"
echo "  1. Generate consumer credit solution brief"
echo "  2. Find all payment card operations"
echo "  3. Create sequence diagram for card issuance"
echo "  4. Get ERD for transaction flow"
echo "  5. Export Postman collection for testing"
echo ""

echo "=========================================="
echo ""
echo "Starting server..."
echo ""

cd "$SCRIPT_DIR"
python -m src.solutions_mcp_server