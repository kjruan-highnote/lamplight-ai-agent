# Program Configurations

This directory contains YAML configuration files for different card program types. All configurations follow a consistent schema for easy maintenance and generation.

## Consistent Schema Structure

All program YAML files follow this structure:

```yaml
program_type: string           # Unique identifier for the program
vendor: string                  # Vendor name (e.g., 'highnote')
version: string                 # Configuration version
api_type: string               # API type ('graphql' or 'rest')

metadata:
  name: string                 # Display name for the program
  description: string          # Program description
  base_url: string            # API base URL
  authentication:
    type: string              # Auth type
    header: string            # Auth header name

capabilities:                  # List of key capabilities
  - capability_1
  - capability_2

categories:                    # Operation categories
  - name: string              # Category identifier
    display_name: string      # Display name
    description: string       # Category description
    sandbox_only: boolean     # Optional: sandbox-only flag
    operations:               # List of operation names
      - OperationName1
      - OperationName2

workflows:                     # Standard workflows
  - name: string
    description: string
    required: boolean
    steps:
      - operation: string
        required: boolean
        description: string

entities:                      # Core entities
  - name: string
    description: string
    primary: boolean

performance:                   # Performance specifications
  request_rate: object
  complexity: object
  api: object

compliance:                    # Compliance requirements
  standards: array
  regulations: array
  security: object

integrations:                  # Integration requirements
  webhooks: object
  reporting: object

resources:                     # Documentation and tools
  documentation: array
  developer_tools: array
  support: array
  monitoring: array
```

## Available Programs

| Program Type | Description | Status |
|-------------|-------------|---------|
| `ap_automation` | Accounts Payable automation with virtual cards | ✅ Active |
| `consumer_credit` | Consumer credit card program | ✅ Active |
| `consumer_prepaid` | Consumer prepaid card program | ✅ Active |
| `commercial_credit` | Commercial credit card program | ✅ Active |
| `commercial_prepaid` | Commercial prepaid card program | ✅ Active |
| `consumer_charge` | Consumer charge card program | ✅ Active |
| `commercial_charge` | Commercial charge card program | ✅ Active |

## Refreshing from Postman Collections

To update program configurations from Postman collections:

### Single Collection
```bash
cd solution-generator
npx tsx src/cli/postman-convert.ts convert \
  -i ../data/postman/collection.json \
  -p program_type \
  -o ../data/programs/program_type.yaml
```

### Batch Update
```bash
# From the ship-agent directory
./scripts/refresh-programs.sh
```

This will:
1. Backup existing YAML files
2. Convert all Postman collections to consistent YAML format
3. Validate the generated configurations
4. Show differences if requested

### Postman CLI Tool

The `postman-convert` CLI provides several commands:

#### Convert a Single Collection
```bash
npx tsx src/cli/postman-convert.ts convert \
  -i <collection.json> \
  -p <program_type> \
  -o <output.yaml> \
  -v <vendor>
```

#### Batch Convert Multiple Collections
```bash
npx tsx src/cli/postman-convert.ts batch \
  -d <collections_directory> \
  -o <output_directory> \
  -v <vendor>
```

#### Validate a YAML Configuration
```bash
npx tsx src/cli/postman-convert.ts validate \
  -f <config.yaml>
```

#### Refresh Existing Configurations
```bash
npx tsx src/cli/postman-convert.ts refresh \
  -d <collections_directory> \
  -p <programs_directory> \
  --backup
```

## Key Differences from Legacy Format

The new consistent schema differs from the legacy `ap_automation.yaml` format:

### Old Format (ap_automation.yaml)
- Mixed structure with categories and operations at different levels
- Included GraphQL queries inline
- Inconsistent field naming

### New Format (All Programs)
- Consistent structure across all programs
- Operations listed by name only (no queries)
- Standardized sections for all programs
- Easier to maintain and generate

## Adding a New Program

1. Create a Postman collection for the new program
2. Save it in `/data/postman/`
3. Run the converter:
   ```bash
   npx tsx src/cli/postman-convert.ts convert \
     -i ../data/postman/new_program.json \
     -p new_program_type \
     -o ../data/programs/new_program_type.yaml
   ```
4. Validate the generated configuration:
   ```bash
   npx tsx src/cli/postman-convert.ts validate \
     -f ../data/programs/new_program_type.yaml
   ```

## Customizing Configurations

After generating from Postman, you can manually edit the YAML files to:
- Add or modify capabilities
- Update workflows
- Add compliance requirements
- Customize resources and documentation links

## Version Control

All YAML files should be version controlled. When refreshing from Postman:
1. Review the differences carefully
2. Ensure no manual customizations are lost
3. Update the version number if significant changes are made

## Support

For issues or questions about program configurations:
1. Check the validation using the CLI tool
2. Review the Postman collection for source data
3. Ensure the schema matches the structure above