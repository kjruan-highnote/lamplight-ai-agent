#!/bin/bash

# ============================================================================
# Quick Feedback Processor
# 
# Simplified script for processing feedback with sensible defaults.
# Automatically detects program and customer from file path/name.
#
# Usage: ./quick-feedback.sh <edited-md-file>
# ============================================================================

set -e

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "\n${CYAN}=== Quick Feedback Processor ===${NC}\n"

# Check if file provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <edited-markdown-file>"
    echo ""
    echo "This will:"
    echo "  1. Analyze changes in the document"
    echo "  2. Apply high-confidence updates automatically"
    echo "  3. Regenerate the solution with improvements"
    echo "  4. Export to HTML format"
    exit 1
fi

EDITED_FILE="$1"

# Check if file exists
if [ ! -f "$EDITED_FILE" ]; then
    echo "Error: File not found: $EDITED_FILE"
    exit 1
fi

echo -e "${YELLOW}Processing: $(basename "$EDITED_FILE")${NC}\n"

# Run the full processor with auto settings
"$SCRIPT_DIR/process-feedback.sh" \
    --auto-apply \
    --regenerate \
    --html \
    --verbose \
    "$EDITED_FILE"

echo -e "\n${GREEN}✓ Quick feedback processing complete!${NC}"
echo "Check the generated files in the output directory."