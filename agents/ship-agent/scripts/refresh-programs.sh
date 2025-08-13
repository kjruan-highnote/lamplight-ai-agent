#!/bin/bash

# Script to refresh all program configurations from Postman collections
# This ensures consistent schema across all YAML files

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
POSTMAN_DIR="$PROJECT_ROOT/data/postman"
PROGRAMS_DIR="$PROJECT_ROOT/data/programs"
BACKUP_DIR="$PROGRAMS_DIR/backups/$(date +%Y%m%d_%H%M%S)"

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  Program Configuration Refresh Tool${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Check if Postman directory exists
if [ ! -d "$POSTMAN_DIR" ]; then
    echo -e "${RED}Error: Postman directory not found: $POSTMAN_DIR${NC}"
    exit 1
fi

# Create backup directory
echo -e "${BLUE}Creating backup directory...${NC}"
mkdir -p "$BACKUP_DIR"

# Backup existing YAML files
echo -e "${BLUE}Backing up existing program configurations...${NC}"
for yaml_file in "$PROGRAMS_DIR"/*.yaml; do
    if [ -f "$yaml_file" ]; then
        basename=$(basename "$yaml_file")
        cp "$yaml_file" "$BACKUP_DIR/$basename"
        echo -e "  ${GRAY}Backed up: $basename${NC}"
    fi
done
echo -e "${GREEN}✓ Backups created in: $BACKUP_DIR${NC}"
echo ""

# Define program mappings
declare -A PROGRAM_MAPPINGS=(
    ["Triplink.postman_collection.json"]="ap_automation"
    ["Consumer Credit.postman_collection.json"]="consumer_credit"
    ["Consumer Prepaid.postman_collection.json"]="consumer_prepaid"
    ["Commercial Credit.postman_collection.json"]="commercial_credit"
    ["Commercial Prepaid.postman_collection.json"]="commercial_prepaid"
)

# Process each Postman collection
echo -e "${BLUE}Processing Postman collections...${NC}"
echo ""

cd "$PROJECT_ROOT/solution-generator"

for collection_file in "$POSTMAN_DIR"/*.postman_collection.json; do
    if [ -f "$collection_file" ]; then
        filename=$(basename "$collection_file")
        
        # Determine program type
        if [ ${PROGRAM_MAPPINGS[$filename]+_} ]; then
            program_type="${PROGRAM_MAPPINGS[$filename]}"
        else
            # Derive from filename
            program_type=$(echo "$filename" | sed 's/.postman_collection.json//' | tr '[:upper:]' '[:lower:]' | tr ' ' '_' | tr '.' '_')
        fi
        
        output_file="$PROGRAMS_DIR/${program_type}.yaml"
        
        echo -e "${YELLOW}Converting: $filename${NC}"
        echo -e "  Program type: ${CYAN}$program_type${NC}"
        
        # Run the converter
        if npx tsx src/cli/postman-convert.ts convert \
            -i "$collection_file" \
            -p "$program_type" \
            -o "$output_file" \
            -v highnote > /dev/null 2>&1; then
            
            echo -e "  ${GREEN}✓ Generated: ${program_type}.yaml${NC}"
            
            # Validate the generated file
            if npx tsx src/cli/postman-convert.ts validate -f "$output_file" > /dev/null 2>&1; then
                echo -e "  ${GREEN}✓ Validated successfully${NC}"
            else
                echo -e "  ${YELLOW}⚠ Validation warnings${NC}"
            fi
        else
            echo -e "  ${RED}✗ Failed to convert${NC}"
        fi
        echo ""
    fi
done

# Summary
echo -e "${CYAN}========================================${NC}"
echo -e "${GREEN}✓ Program refresh complete!${NC}"
echo ""
echo -e "Backups saved to:"
echo -e "  ${BLUE}$BACKUP_DIR${NC}"
echo ""
echo -e "Updated programs in:"
echo -e "  ${BLUE}$PROGRAMS_DIR${NC}"
echo ""

# Offer to view differences
read -p "Would you like to view the differences? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    for yaml_file in "$PROGRAMS_DIR"/*.yaml; do
        if [ -f "$yaml_file" ]; then
            basename=$(basename "$yaml_file")
            backup_file="$BACKUP_DIR/$basename"
            
            if [ -f "$backup_file" ]; then
                echo -e "${CYAN}Differences in $basename:${NC}"
                diff -u "$backup_file" "$yaml_file" || true
                echo ""
                read -p "Press Enter to continue..." -n 1 -r
                echo
            fi
        fi
    done
fi

echo -e "${GREEN}Done!${NC}"