# Ship Agent - Solution Document Generator

## Overview

The Ship Agent generates comprehensive solution documents for financial service programs by combining:

1. **Program Configurations** (YAML) - Technical specifications and requirements
2. **Customer Contexts** (JSON) - Business requirements and narrative
3. **Postman Collections** (JSON) - Actual API operations

## Core Pattern

```
Program Config (YAML) + Customer Context (JSON) = Solution Document (Markdown)
```

- **No hardcoded logic** - All content comes from data files
- **Clean separation** - Technical vs business concerns
- **Flexible generation** - Works with or without customer context

## Quick Start

### Generate a Solution Document

```bash
# Generic solution (config only)
python src/modular_solution_generator.py --program ap_automation

# Customer-specific solution (config + context)
python src/modular_solution_generator.py --program ap_automation --customer trip_com
```

### List Available Resources

```bash
# List available programs
python src/modular_solution_generator.py --list-programs

# List available customer contexts
python src/modular_solution_generator.py --list-contexts
```

## File Structure

```
ship-agent/
├── src/
│   ├── modular_solution_generator.py  # Main generator
│   ├── postman_sync.py               # Sync Postman → operations
│   └── api.py                        # API endpoints
├── data/
│   ├── programs/                     # Program configs (YAML)
│   │   ├── ap_automation.yaml
│   │   ├── consumer_credit.yaml
│   │   └── ...
│   ├── contexts/                     # Customer contexts (JSON)
│   │   └── trip_com_context_v2.json
│   ├── postman/                      # Postman collections
│   │   └── Trip.com.postman_collection.json
│   └── operations/                   # Extracted operations
└── data/generated/                   # Output documents
```

## Key Features

✅ **Data-Driven** - No hardcoded customer logic
✅ **Modular** - Combine configs and contexts flexibly
✅ **Scalable** - Add programs/customers without code changes
✅ **Maintainable** - Clean separation of concerns

For detailed usage, see `MODULAR_GENERATOR_README.md`
EOF < /dev/null