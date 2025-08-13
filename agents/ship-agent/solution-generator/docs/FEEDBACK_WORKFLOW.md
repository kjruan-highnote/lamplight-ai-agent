# Feedback Workflow Documentation

## Overview

The feedback workflow system enables iterative refinement of generated solution documents based on customer feedback. It provides version control, change tracking, and automatic updates to program configurations and customer contexts.

## Key Features

- **Version Control**: Git-based tracking of document iterations
- **Change Analysis**: Automated diff analysis and categorization
- **Smart Suggestions**: AI-powered suggestions for config updates
- **Automatic Regeneration**: Regenerate solutions with incorporated feedback
- **Session Management**: Track multiple feedback sessions

## Workflow Steps

### 1. Generate Initial Solution

First, generate a solution document:

```bash
npm run generate -- generate --program ap_automation --customer trip_com --format html
```

### 2. Start Feedback Session

Initialize a feedback session for the generated document:

```bash
npm run generate -- feedback-start \
  --document ../data/generated/trip_com/ap_automation_solution_2025-08-12.md \
  --program ap_automation \
  --customer trip_com
```

This will:
- Create a version snapshot of the original document
- Start a new git branch for tracking changes
- Return a session ID for tracking

### 3. Customer Edits Document

The customer can now edit the markdown document directly:
- Add/remove sections
- Modify requirements
- Update workflows
- Correct information
- Add specific details

### 4. Process Feedback

Analyze the edited document and apply changes:

```bash
npm run generate -- feedback-process \
  --session session_1234567890 \
  --document ../data/generated/trip_com/ap_automation_solution_2025-08-12.md
```

This will:
- Analyze all changes made to the document
- Generate suggestions for updating configs
- Apply high-confidence updates automatically
- Optionally regenerate the solution

### 5. Review Changes

Analyze changes without applying them:

```bash
npm run generate -- feedback-analyze \
  --document ../data/generated/trip_com/ap_automation_solution_2025-08-12.md
```

This generates a detailed diff report showing:
- All changes by section
- Suggested config updates
- Confidence levels

## Interactive Mode

For a guided workflow, use interactive mode:

```bash
npm run generate -- feedback interactive
```

This provides a menu-driven interface for:
- Starting new sessions
- Processing feedback
- Viewing history
- Completing sessions

## Feedback Analysis

The system analyzes changes and categorizes them:

### Context Updates
Changes to these sections update the customer context JSON:
- Business Context
- Objectives
- Requirements
- Stakeholders
- Success Metrics

### Program Updates
Changes to these sections update the program YAML:
- Performance Requirements
- API Operations
- Compliance & Security
- Integration Requirements
- Workflows

## Automatic Updates

### High Confidence (>60%)
Automatically applied:
- New list items added
- Clear value updates
- Consistent formatting changes

### Low Confidence (<60%)
Require manual review:
- Major structural changes
- Conflicting information
- Deletions of required content

## Version Control Integration

### Branch Strategy
```
main
  └── feedback/session_1234567890
       ├── Initial document commit
       ├── Iteration 1 changes
       ├── Iteration 2 changes
       └── Final merged version
```

### Commands
- Start session: Creates new branch
- Process feedback: Commits changes
- Complete session: Merges to main

## Configuration

### Workflow Options
```javascript
{
  autoCommit: true,        // Automatically commit changes
  autoRegenerate: true,    // Regenerate after applying feedback
  requireApproval: false,  // Require approval for updates
  trackingBranch: 'feedback' // Git branch prefix
}
```

## Session Management

### View Active Sessions
```bash
npm run generate -- feedback list --active
```

### Complete a Session
```bash
npm run generate -- feedback complete --session session_1234567890
```

### View History
```bash
npm run generate -- feedback list
```

## Example Workflow

```bash
# 1. Generate initial solution
npm run generate -- generate -p ap_automation -c trip_com

# 2. Start feedback session
npm run generate -- feedback-start \
  -d ../data/generated/trip_com/ap_automation_solution_2025-08-12.md \
  -p ap_automation -c trip_com

# Output: Session ID: session_1234567890

# 3. Customer edits the document
# (Manual editing of the markdown file)

# 4. Process feedback
npm run generate -- feedback-process \
  -s session_1234567890 \
  -d ../data/generated/trip_com/ap_automation_solution_2025-08-12.md

# 5. Review regenerated solution
# Solution is automatically regenerated with feedback incorporated

# 6. Complete session
npm run generate -- feedback complete -s session_1234567890
```

## Benefits

1. **Iterative Refinement**: Multiple rounds of feedback without losing history
2. **Automatic Learning**: Context and configs improve with each iteration
3. **Version Control**: Full history of changes and decisions
4. **Time Savings**: Automated updates reduce manual work
5. **Quality Improvement**: Each iteration improves accuracy

## File Structure

```
data/
├── feedback/
│   ├── feedback_1234567890.json    # Feedback reports
│   └── diff_report_1234567890.md   # Diff analysis
├── feedback-sessions/
│   └── session_1234567890.json     # Session metadata
├── versions/
│   ├── v_1234567890_abc123.json    # Version snapshots
│   └── mapping.json                # File-to-version mapping
├── contexts/
│   └── triplink_context_v2.json    # Updated with feedback
└── programs/
    └── ap_automation.yaml           # Updated with feedback
```

## Best Practices

1. **Small Iterations**: Process feedback frequently for better tracking
2. **Clear Comments**: Add comments in markdown for specific requests
3. **Section Focus**: Edit related sections together
4. **Review Reports**: Check diff reports before applying changes
5. **Test Regeneration**: Verify regenerated documents meet expectations

## Troubleshooting

### Session Not Found
Ensure you're using the correct session ID from the start command.

### Git Conflicts
The system uses separate branches to avoid conflicts. If issues occur, manually resolve in git.

### Low Confidence Updates
Review the diff report and manually apply changes if needed.

### Context Not Updating
Check that changes are in recognized sections (Business Context, Requirements, etc.)

## Future Enhancements

- [ ] Web UI for feedback management
- [ ] Real-time collaboration
- [ ] Change approval workflows
- [ ] Machine learning for better suggestions
- [ ] Integration with issue tracking systems