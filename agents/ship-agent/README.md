# Ship Agent

A flexible, data-driven agent for generating program-specific Postman collections and API operations for financial programs.

## Overview

The Ship Agent generates customized API collections based on:
- **Program Type**: consumer_credit, commercial_prepaid, ap_automation, etc.
- **Customer Dimensions**: customer name, environment, risk tiers, etc.
- **Selected Operations**: categories, flows, and specific operations

## Quick Start

The unified generator accepts structured JSON or YAML input files:

```bash
# Generate from input file
python src/unified_generator.py input.yaml
python src/unified_generator.py config.json

# Show sample input format
python src/unified_generator.py --sample

# Validate input file without generating
python src/unified_generator.py --validate input.yaml
```

## Input File Formats

### 1. Collection Generation

```yaml
type: collection

config:
  program_type: consumer_credit
  dimensions:
    customer: "ABC Bank"
    environment: production
    region: us-east
  options:
    categories:
      - person_account_holder
      - payment_cards
    flows:
      - standard_onboarding

outputs:
  - collection    # Postman collection
  - yaml         # Operations documentation
  - summary      # Summary report
  - test_data    # Test data
  - solutions    # Solutions document (markdown)
```

### 2. Batch Generation

```yaml
type: batch

batch:
  - program_type: consumer_credit
    dimensions:
      customer: "Bank1"
      environment: sandbox
    outputs: [collection, summary]
    
  - program_type: commercial_prepaid
    dimensions:
      customer: "Bank2"
      environment: production
    outputs: [collection, yaml, summary]
```

### 3. YAML from Operations

```json
{
  "type": "yaml_from_operations",
  "operations_file": "data/operations/consumer_credit_operations.json"
}
```

### 4. Solutions Document Generation

```yaml
type: solutions

postman_file: "data/postman/Consumer Credit.postman_collection.json"
customer: "ABC Bank"
program_type: consumer_credit
```

## Available Program Types

38+ program types including:
- `consumer_credit` - Consumer credit cards
- `commercial_credit` - Business credit cards
- `consumer_prepaid` - Consumer prepaid cards
- `commercial_prepaid` - Business prepaid cards
- `ap_automation` - Accounts payable automation
- `fleet` - Fleet card programs
- `acquiring` - Merchant acquiring
- And 30+ more...

## Output Files

The generator creates:

1. **Postman Collection** (`<program>_collection.json`)
   - Ready to import into Postman
   - Pre-configured GraphQL operations
   - Customer-specific variables

2. **Operations YAML** (`<program>_operations.yaml`)
   - Documentation of generated operations
   - Metadata and dimensions used

3. **Summary Report** (`<program>_summary.txt`)
   - Human-readable summary
   - Operation counts by category
   - Configuration details

4. **Solutions Document** (`<program>_solution.md`)
   - Professional markdown documentation
   - Executive summary and use cases
   - Implementation flows and integration guide
   - Security and compliance information

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│ Postman Export  │────▶│   Migrator   │────▶│ Operations JSON │
└─────────────────┘     └──────────────┘     └─────────────────┘
                                                      │
                                                      ▼
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│ YAML Config     │────▶│   Unified    │◀────│  Program YAML   │
└─────────────────┘     │  Generator   │     └─────────────────┘
                        └──────────────┘
                                │
                                ▼
                        ┌─────────────────┐
                        │   Generated     │
                        │  Collections    │
                        └─────────────────┘
```

## API Usage

Start the API server:

```bash
python src/api.py
```

### Endpoints

- `GET /health` - Health check
- `GET /programs` - List available programs
- `GET /programs/{type}` - Get program details
- `POST /generate/collection` - Generate collection
- `POST /generate/test-data` - Generate test data

### Example API Request

```bash
curl -X POST http://localhost:8003/generate/collection \
  -H "Content-Type: application/json" \
  -d '{
    "program_type": "consumer_credit",
    "dimensions": {
      "customer": "FirstBank",
      "environment": "sandbox"
    },
    "options": {
      "categories": ["person_account_holder", "payment_cards"]
    }
  }'
```

## Development

### Adding New Program Types

1. Export Postman collection
2. Run migrator to extract operations
3. Generate YAML config
4. Customize as needed

### Project Structure

```
ship-agent/
├── src/
│   ├── ship_agent_simplified.py    # Core agent logic
│   ├── unified_generator.py        # CLI generator
│   ├── solutions_document_generator.py  # Solutions doc generator
│   ├── postman_to_mongodb_migrator.py  # Migration tool
│   └── api.py                      # FastAPI server
├── data/
│   ├── operations/                 # Extracted operations
│   ├── programs/                   # Program YAML configs
│   └── generated/                  # Generated collections
├── config/                         # Sample configurations
└── examples/                       # Usage examples
```

## Requirements

- Python 3.8+
- FastAPI
- PyYAML
- See requirements.txt for full list

## Running

The Ship Agent is automatically started with other agents using:
```bash
./scripts/start_all_agents.sh
```

Or run standalone:
```bash
python src/api.py
```

## Integration with Other Agents

Ship Agent integrates with:
- **Schema Agent**: Validates generated queries
- **Document Agent**: Gets business rules and examples
- **Advisory Agent**: Provides generation capabilities