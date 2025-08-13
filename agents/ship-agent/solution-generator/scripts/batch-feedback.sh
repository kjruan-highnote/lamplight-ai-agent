#!/bin/bash

# ============================================================================
# Batch Feedback Processor
# 
# Process multiple feedback documents in a single run.
# Useful for processing feedback from multiple customers or programs.
#
# Usage: ./batch-feedback.sh [options] <directory-with-edited-files>
# ============================================================================

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROCESS_SCRIPT="$SCRIPT_DIR/process-feedback.sh"

# Default values
AUTO_APPLY=false
REGENERATE=false
EXPORT_HTML=false
PATTERN="*_edited.md"
SUMMARY_FILE=""

print_usage() {
    cat << EOF
Usage: $0 [OPTIONS] <directory>

Process multiple edited markdown files in batch.

OPTIONS:
    -a, --auto-apply     Auto-apply high-confidence changes
    -r, --regenerate     Regenerate solutions after feedback
    -h, --html           Export to HTML format
    -p, --pattern        File pattern to match (default: *_edited.md)
    -s, --summary        Output summary file path
    --help               Show this help message

EXAMPLES:
    # Process all edited files in a directory
    $0 ./feedback-docs/

    # Auto-apply and regenerate with HTML
    $0 -a -r -h ./feedback-docs/

    # Process specific pattern
    $0 -p "*triplink*.md" ./feedback-docs/

EOF
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -a|--auto-apply)
            AUTO_APPLY=true
            shift
            ;;
        -r|--regenerate)
            REGENERATE=true
            shift
            ;;
        -h|--html)
            EXPORT_HTML=true
            shift
            ;;
        -p|--pattern)
            PATTERN="$2"
            shift 2
            ;;
        -s|--summary)
            SUMMARY_FILE="$2"
            shift 2
            ;;
        --help)
            print_usage
            exit 0
            ;;
        *)
            DIRECTORY="$1"
            shift
            ;;
    esac
done

# Validate directory
if [ -z "$DIRECTORY" ]; then
    echo -e "${RED}Error: No directory specified${NC}"
    print_usage
    exit 1
fi

if [ ! -d "$DIRECTORY" ]; then
    echo -e "${RED}Error: Directory not found: $DIRECTORY${NC}"
    exit 1
fi

# Find matching files
echo -e "\n${CYAN}=== Batch Feedback Processor ===${NC}\n"
echo -e "Searching for files matching: ${YELLOW}$PATTERN${NC} in ${BLUE}$DIRECTORY${NC}\n"

FILES=($(find "$DIRECTORY" -type f -name "$PATTERN" 2>/dev/null))

if [ ${#FILES[@]} -eq 0 ]; then
    echo -e "${YELLOW}No files found matching pattern: $PATTERN${NC}"
    exit 0
fi

echo -e "Found ${GREEN}${#FILES[@]}${NC} file(s) to process:\n"
for file in "${FILES[@]}"; do
    echo "  - $(basename "$file")"
done

# Initialize counters
TOTAL=${#FILES[@]}
SUCCESS=0
FAILED=0
SKIPPED=0

# Initialize summary
if [ -n "$SUMMARY_FILE" ]; then
    cat > "$SUMMARY_FILE" << EOF
# Batch Feedback Processing Summary
Generated: $(date)
Directory: $DIRECTORY
Pattern: $PATTERN
Total Files: $TOTAL

## Processing Results

| File | Status | Session ID | Notes |
|------|--------|------------|-------|
EOF
fi

# Process each file
echo -e "\n${CYAN}Starting batch processing...${NC}\n"

for i in "${!FILES[@]}"; do
    file="${FILES[$i]}"
    filename=$(basename "$file")
    num=$((i + 1))
    
    echo -e "${BLUE}[$num/$TOTAL]${NC} Processing: ${YELLOW}$filename${NC}"
    echo "----------------------------------------"
    
    # Build command
    CMD="$PROCESS_SCRIPT"
    [ "$AUTO_APPLY" = true ] && CMD="$CMD --auto-apply"
    [ "$REGENERATE" = true ] && CMD="$CMD --regenerate"
    [ "$EXPORT_HTML" = true ] && CMD="$CMD --html"
    CMD="$CMD \"$file\""
    
    # Process file
    if eval $CMD > /tmp/batch_feedback_$$.log 2>&1; then
        echo -e "${GREEN}✓ Success${NC}"
        SUCCESS=$((SUCCESS + 1))
        
        # Extract session ID from log
        SESSION_ID=$(grep -o 'session_[0-9]*' /tmp/batch_feedback_$$.log | head -1 || echo "N/A")
        
        # Add to summary
        if [ -n "$SUMMARY_FILE" ]; then
            echo "| $filename | ✅ Success | $SESSION_ID | Processed |" >> "$SUMMARY_FILE"
        fi
    else
        echo -e "${RED}✗ Failed${NC}"
        FAILED=$((FAILED + 1))
        
        # Show error
        echo -e "${RED}Error output:${NC}"
        tail -10 /tmp/batch_feedback_$$.log
        
        # Add to summary
        if [ -n "$SUMMARY_FILE" ]; then
            ERROR_MSG=$(tail -1 /tmp/batch_feedback_$$.log | head -c 50)
            echo "| $filename | ❌ Failed | N/A | $ERROR_MSG |" >> "$SUMMARY_FILE"
        fi
    fi
    
    echo ""
done

# Clean up
rm -f /tmp/batch_feedback_$$.log

# Show summary
echo -e "${CYAN}=== Batch Processing Complete ===${NC}\n"
echo -e "Total files:    ${TOTAL}"
echo -e "Successful:     ${GREEN}${SUCCESS}${NC}"
echo -e "Failed:         ${RED}${FAILED}${NC}"
echo -e "Skipped:        ${YELLOW}${SKIPPED}${NC}"

if [ -n "$SUMMARY_FILE" ]; then
    # Append summary stats to file
    cat >> "$SUMMARY_FILE" << EOF

## Summary Statistics

- **Total Files:** $TOTAL
- **Successful:** $SUCCESS
- **Failed:** $FAILED
- **Skipped:** $SKIPPED
- **Success Rate:** $(echo "scale=1; $SUCCESS * 100 / $TOTAL" | bc)%

Generated on $(date) by batch-feedback.sh
EOF
    
    echo -e "\nSummary saved to: ${BLUE}$SUMMARY_FILE${NC}"
fi

# Exit with appropriate code
if [ $FAILED -gt 0 ]; then
    exit 1
else
    echo -e "\n${GREEN}✓ All operations completed successfully${NC}"
    exit 0
fi