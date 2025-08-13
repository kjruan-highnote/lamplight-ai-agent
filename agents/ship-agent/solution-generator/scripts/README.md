# Feedback Processing Scripts

This directory contains shell scripts for processing customer feedback on generated solution documents.

## Scripts Overview

### 1. `process-feedback.sh` - Main Feedback Processor
The comprehensive feedback processing script with full control over all options.

**Features:**
- Analyzes changes in edited documents
- Applies updates to context and program configs
- Regenerates solutions with improvements
- Supports multiple export formats
- Interactive and batch modes
- Backup and rollback capabilities

**Usage:**
```bash
# Basic usage
./process-feedback.sh -p ap_automation -c trip_com edited_solution.md

# Auto-apply changes and regenerate with HTML
./process-feedback.sh -p ap_automation -c trip_com -a -r -h edited_solution.md

# Interactive mode
./process-feedback.sh -i edited_solution.md

# Dry run to preview changes
./process-feedback.sh -p ap_automation -c trip_com -d edited_solution.md
```

**Options:**
- `-p, --program <type>` - Program type (e.g., ap_automation)
- `-c, --customer <name>` - Customer name (e.g., trip_com)
- `-s, --session <id>` - Use existing session ID
- `-a, --auto-apply` - Auto-apply high-confidence changes
- `-r, --regenerate` - Regenerate solution after feedback
- `-h, --html` - Export to HTML format
- `-f, --pdf` - Export to PDF format
- `-i, --interactive` - Interactive mode with prompts
- `-n, --no-backup` - Skip creating backups
- `-d, --dry-run` - Analyze only, don't apply changes
- `-v, --verbose` - Show detailed output

### 2. `quick-feedback.sh` - Quick Processor
Simplified script for quick feedback processing with sensible defaults.

**Features:**
- Auto-detects program and customer from filename
- Automatically applies high-confidence changes
- Regenerates solution with HTML export
- Single command operation

**Usage:**
```bash
# Process feedback with all automatic options
./quick-feedback.sh edited_solution.md
```

This is equivalent to:
```bash
./process-feedback.sh --auto-apply --regenerate --html --verbose edited_solution.md
```

### 3. `batch-feedback.sh` - Batch Processor
Process multiple feedback documents in a single run.

**Features:**
- Process entire directories of feedback
- Configurable file patterns
- Summary report generation
- Parallel processing support

**Usage:**
```bash
# Process all edited files in a directory
./batch-feedback.sh ./feedback-docs/

# Auto-apply and regenerate all with HTML
./batch-feedback.sh -a -r -h ./feedback-docs/

# Process specific pattern with summary
./batch-feedback.sh -p "*triplink*.md" -s summary.md ./feedback-docs/
```

**Options:**
- `-a, --auto-apply` - Auto-apply changes for all files
- `-r, --regenerate` - Regenerate all solutions
- `-h, --html` - Export all to HTML
- `-p, --pattern` - File pattern to match (default: *_edited.md)
- `-s, --summary` - Generate summary report file

## Workflow Examples

### Example 1: Single Document Feedback
```bash
# Customer edits the generated solution
cp ap_automation_solution.md ap_automation_solution_edited.md
# ... customer makes changes ...

# Process the feedback
./quick-feedback.sh ap_automation_solution_edited.md
```

### Example 2: Multiple Customer Feedback
```bash
# Create feedback directory
mkdir customer-feedback/
cp customer1_solution.md customer-feedback/customer1_edited.md
cp customer2_solution.md customer-feedback/customer2_edited.md

# Process all feedback
./batch-feedback.sh -a -r -h customer-feedback/
```

### Example 3: Review Changes Before Applying
```bash
# Dry run to see what would change
./process-feedback.sh -p ap_automation -c trip_com -d -v edited_solution.md

# If satisfied, apply the changes
./process-feedback.sh -p ap_automation -c trip_com -a -r edited_solution.md
```

### Example 4: Interactive Feedback Session
```bash
# Start interactive mode for guided process
./process-feedback.sh -i customer_edited_solution.md

# Follow the prompts to:
# - Confirm program type
# - Confirm customer name
# - Choose whether to auto-apply
# - Choose whether to regenerate
# - Select export formats
```

## File Naming Conventions

For automatic detection to work best, follow these naming patterns:

- Original: `<program>_solution_<date>.md`
- Edited: `<program>_solution_<date>_edited.md`
- Directory structure: `data/generated/<customer>/<files>`

Examples:
- `ap_automation_solution_2025-08-12.md`
- `ap_automation_solution_2025-08-12_edited.md`
- `data/generated/trip_com/ap_automation_solution.md`

## Output Files

After processing, you'll find:

1. **Analysis Report**: `data/feedback/diff_report_<timestamp>.md`
2. **Updated Context**: `data/contexts/<customer>_context_v2.json`
3. **Updated Program**: `data/programs/<program>.yaml`
4. **Regenerated Solution**: `data/generated/<customer>/<program>_solution_<date>.md`
5. **HTML Export**: `data/generated/<customer>/<program>_solution_<date>.html`
6. **PDF Export**: `data/generated/<customer>/<program>_solution_<date>.pdf`
7. **Backups**: `data/backups/<timestamp>/`

## Best Practices

1. **Always Review First**: Use dry-run mode to preview changes before applying
2. **Keep Backups**: Default backup behavior ensures you can rollback
3. **Use Sessions**: Sessions track iterations and maintain history
4. **Small Changes**: Process feedback frequently for better tracking
5. **Clear Comments**: Add comments in markdown (e.g., `<!-- FEEDBACK: ... -->`)
6. **Test Regeneration**: Verify regenerated documents meet expectations

## Troubleshooting

### Session Not Found
```bash
# Explicitly start a new session
./process-feedback.sh -p <program> -c <customer> edited.md
```

### Auto-detection Failed
```bash
# Manually specify program and customer
./process-feedback.sh -p ap_automation -c trip_com edited.md
```

### Changes Not Applied
```bash
# Use verbose mode to see confidence scores
./process-feedback.sh -v -p <program> -c <customer> edited.md

# Force auto-apply for all changes
./process-feedback.sh -a -p <program> -c <customer> edited.md
```

### Regeneration Failed
```bash
# Check program config exists
ls ../data/programs/<program>.yaml

# Check context exists
ls ../data/contexts/<customer>_context*.json
```

## Environment Requirements

- Node.js >= 18.0.0
- npm with solution-generator installed
- git (optional, for version control)
- bash shell

## Integration with CI/CD

These scripts can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Action
- name: Process Customer Feedback
  run: |
    ./scripts/batch-feedback.sh \
      --auto-apply \
      --regenerate \
      --html \
      --summary feedback-summary.md \
      ./customer-feedback/
```

## Contributing

To add new features to the scripts:

1. Test changes thoroughly
2. Update this README
3. Add examples for new options
4. Ensure backward compatibility

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review verbose output (`-v` flag)
3. Check log files in `data/feedback/`
4. Examine session files in `data/feedback-sessions/`