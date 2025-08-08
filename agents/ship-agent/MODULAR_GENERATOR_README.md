# Modular Solution Generator Guide

## Overview

The Modular Solution Generator is a **data-driven** document generation system that creates comprehensive solution documents by combining:

1. **Program Configs** (YAML) - Technical structure and requirements
2. **Customer Contexts** (JSON) - Business narrative and requirements  
3. **Postman Collections** (JSON) - Actual API operations

## Key Principle: Separation of Concerns

**NO hardcoded customer logic in the generator!**

- **Generator** = Pure logic (reads and combines data)
- **Config** = What (operations, workflows, compliance)
- **Context** = Why (business needs, objectives, use cases)
- **Postman** = How (actual API calls)

## File Structure

```
agents/ship-agent/
├── src/
│   └── modular_solution_generator.py   # Pure generator logic
├── data/
│   ├── programs/                       # Program configs (YAML)
│   │   ├── ap_automation.yaml         # Enhanced config with workflows
│   │   └── trip.com.yaml              # Standard config
│   ├── contexts/                      # Customer contexts (JSON)
│   │   └── trip_com_context_v2.json   # Business narrative
│   └── postman/                       # API collections
│       └── trip.com.json              # Actual operations
```

## Usage

### Basic Usage

```bash
# Generate generic solution (config only)
python src/modular_solution_generator.py --program ap_automation

# Generate customer-specific solution (config + context)
python src/modular_solution_generator.py --program ap_automation --customer trip_com

# List available programs
python src/modular_solution_generator.py --list-programs

# List available contexts
python src/modular_solution_generator.py --list-contexts
```

### Output

Documents are saved to: `data/generated/{customer_name}/{program}_solution_{timestamp}.md`

## Data Source Schemas

### 1. Program Config (YAML)

Defines technical structure and requirements:

```yaml
program_type: ap_automation
vendor: highnote
version: "2.0.0"

# Technical metadata
metadata:
  name: "AP Automation Program"
  description: "Technical description"
  authentication:
    type: bearer

# What the program can do
capabilities:
  - virtual_card_issuance
  - on_demand_funding
  - spend_controls

# Rigid workflows (step-by-step)
workflows:
  onboarding:
    name: "Customer Onboarding"
    steps:
      - operation: CreateApiKey
        required: true
      - operation: CreateCardProduct
        required: true

# Core entities
entities:
  - name: PaymentCard
    description: "Virtual payment cards"
    primary: true

# API operations by category
categories:
  - name: payment_cards
    operations:
      - name: IssuePaymentCard
        type: mutation
        required: true

# Compliance requirements
compliance:
  standards:
    - name: PCI_DSS
      level: 1
  regulations:
    - name: OFAC
      description: "Sanctions screening"
```

### 2. Customer Context (JSON)

Provides business narrative and requirements:

```json
{
  "customer": {
    "name": "Trip.com",
    "industry": "Travel Services"
  },
  
  "business_context": {
    "current_state": {
      "description": "Current situation...",
      "pain_points": ["High costs", "Legacy systems"]
    },
    "objectives": {
      "primary": ["Cut costs", "Modernize API"],
      "secondary": ["Improve efficiency"]
    }
  },
  
  "use_cases": {
    "primary": [{
      "title": "Supplier Payments",
      "description": "Pay suppliers directly",
      "scenarios": ["Hotels", "Airlines"],
      "value_proposition": "Reduce risk"
    }]
  },
  
  "requirements": {
    "business": ["High volume support"],
    "operational": ["24/7 availability"],
    "financial": ["30% cost reduction"]
  },
  
  "success_metrics": {
    "kpis": [{
      "metric": "Cost Reduction",
      "target": "30%",
      "timeline": "6 months"
    }]
  }
}
```

## Section Generation Logic

| Section | Primary Source | Fallback | Example |
|---------|---------------|----------|---------|
| **Title** | Context customer name | Config name | "AP Automation for Trip.com" |
| **Executive Summary** | Context business_context | Config description | Trip.com's specific needs |
| **Technical Overview** | Config (entities, capabilities) | - | Core entities, capabilities |
| **Use Cases** | Context use_cases | Generated from program type | Supplier payments, etc. |
| **Workflows** | Config workflows | Postman patterns | Onboarding steps |
| **API Reference** | Postman operations | Config categories | Actual API calls |
| **Security** | Config compliance | Standard text | PCI DSS, SOC2 |
| **Success Metrics** | Context metrics | - | KPIs and milestones |

## Adding New Customers

### Step 1: Create Context File

Create `data/contexts/{customer_name}_context.json`:

```json
{
  "customer": {
    "name": "ACME Corp",
    "industry": "Manufacturing"
  },
  "business_context": {
    "current_state": {
      "description": "ACME needs to automate supplier payments..."
    }
  }
}
```

### Step 2: Generate Document

```bash
python src/modular_solution_generator.py --program ap_automation --customer acme_corp
```

## Adding New Programs

### Step 1: Create Program Config

Create `data/programs/{program_type}.yaml`:

```yaml
program_type: fleet_management
vendor: highnote
version: "1.0.0"

capabilities:
  - fleet_cards
  - fuel_tracking
  
workflows:
  card_issuance:
    name: "Fleet Card Issuance"
    steps:
      - operation: IssueFleetCard
```

### Step 2: Add Postman Collection (Optional)

Add `data/postman/{program_type}.json` with actual API calls.

### Step 3: Generate Document

```bash
python src/modular_solution_generator.py --program fleet_management
```

## Best Practices

### DO:
✅ Keep configs focused on **technical structure**
✅ Keep contexts focused on **business narrative**
✅ Use descriptive field names
✅ Provide fallback values in configs
✅ Version your configs and contexts

### DON'T:
❌ Put customer-specific logic in the generator
❌ Mix technical and business content
❌ Hardcode values in the generator
❌ Duplicate information across sources
❌ Put implementation details in contexts

## Advanced Usage

### Custom Templates (Future)

Create Jinja2 templates in `templates/` directory:

```jinja2
{# templates/executive_summary.j2 #}
## Executive Summary

{% if context.business_context %}
{{ context.business_context.current_state.description }}
{% else %}
{{ config.metadata.description }}
{% endif %}

The solution provides {{ config.capabilities|length }} core capabilities.
```

### Validation

The generator validates:
- Required fields in configs
- Operation references in workflows
- Category structure
- Context schema compliance

## Troubleshooting

### "No configuration found"
- Check program name matches filename
- Ensure `.yaml` extension
- Check file is in `data/programs/`

### "Missing required field"
- Configs must have: program_type, vendor, categories
- Check YAML syntax

### Empty sections
- Ensure context has expected structure
- Check Postman collection exists
- Verify field names match schema

## Benefits of This Approach

1. **Reusability**: Same config for multiple customers
2. **Maintainability**: Update data without touching code
3. **Scalability**: Add new programs/customers easily
4. **Consistency**: Standardized document structure
5. **Flexibility**: Optional contexts, graceful fallbacks

## Example Command Sequence

```bash
# 1. Check available programs
python src/modular_solution_generator.py --list-programs

# 2. Check available contexts  
python src/modular_solution_generator.py --list-contexts

# 3. Generate generic AP automation doc
python src/modular_solution_generator.py --program ap_automation

# 4. Generate Trip.com specific doc
python src/modular_solution_generator.py --program ap_automation --customer trip_com

# 5. View generated document
cat data/generated/trip_com/ap_automation_solution_*.md
```

## Summary

The Modular Solution Generator ensures:
- **Clean separation** between structure and narrative
- **No hardcoded** customer logic
- **Data-driven** document generation
- **Easy maintenance** via external configs
- **Flexible output** with graceful fallbacks

This approach scales to any number of programs and customers without code changes!