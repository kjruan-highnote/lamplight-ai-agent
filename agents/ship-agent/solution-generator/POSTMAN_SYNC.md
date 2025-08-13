# Postman Collections Sync & Automation

This system automatically syncs Postman collections, extracts operations, and updates program YAML configurations with scheduling capabilities.

## Features

- 🔄 **Automatic Collection Download** - Fetches all collections from your Postman workspace
- 📊 **Operations Extraction** - Extracts GraphQL operations and categorizes them
- 🔧 **YAML Updates** - Updates program configurations with new operations
- ⏰ **Scheduling** - Run syncs on a schedule using cron patterns
- 📦 **Backup Management** - Automatic backups before updates
- 📝 **Reports** - Generate sync reports and change logs
- 🔍 **Smart Mapping** - References existing operations for schema consistency

## Prerequisites

1. **Postman API Key**: Get from [Postman Account Settings](https://postman.com/settings/me/api-keys)
2. **Workspace ID**: Find in your Postman workspace URL
3. **Node.js**: Version 18.0.0 or higher

## Installation

```bash
cd solution-generator
npm install
npm run build
```

## Quick Start

### 1. Initialize Configuration

```bash
npx tsx src/cli/postman-sync.ts init
```

This will prompt you for:
- Postman API Key
- Workspace ID
- Scheduling preferences

### 2. Run Manual Sync

```bash
npx tsx src/cli/postman-sync.ts run
```

### 3. Start Scheduled Sync

```bash
npx tsx src/cli/postman-sync.ts start
```

## Configuration

The configuration is stored in `postman-sync-config.json`:

```json
{
  "postman": {
    "apiKey": "your-api-key",
    "workspaceId": "your-workspace-id"
  },
  "paths": {
    "collectionsDir": "../data/postman",
    "operationsDir": "../data/operations",
    "programsDir": "../data/programs",
    "backupsDir": "../data/backups"
  },
  "schedule": {
    "enabled": true,
    "cronPattern": "0 0 * * *",
    "timezone": "America/Los_Angeles"
  },
  "options": {
    "autoBackup": true,
    "autoMerge": true,
    "generateReports": true,
    "notifyOnChanges": false
  },
  "programMappings": {
    "Trip.com": "ap_automation",
    "Consumer Credit": "consumer_credit"
  }
}
```

## CLI Commands

### Initialize Configuration
```bash
npx tsx src/cli/postman-sync.ts init
```

### Run Sync Manually
```bash
npx tsx src/cli/postman-sync.ts run [options]
  -c, --config <path>  Path to config file
```

### Start Scheduled Sync
```bash
npx tsx src/cli/postman-sync.ts start [options]
  -c, --config <path>  Path to config file
```

### Check Status
```bash
npx tsx src/cli/postman-sync.ts status
```

### List Collections
```bash
npx tsx src/cli/postman-sync.ts list
```

### Test Extraction
```bash
npx tsx src/cli/postman-sync.ts test -f <collection.json>
```

## Scheduling Options

The system uses cron patterns for scheduling:

- `0 * * * *` - Every hour
- `0 */6 * * *` - Every 6 hours
- `0 0 * * *` - Daily at midnight
- `0 0 * * 0` - Weekly on Sunday
- `0 0 1 * *` - Monthly on the 1st

## Workflow

1. **Download Collections**: Fetches all collections from Postman workspace
2. **Extract Operations**: Analyzes each collection and extracts GraphQL operations
3. **Reference Existing**: Compares with existing operations for consistency
4. **Update Programs**: Merges new operations into program YAML files
5. **Generate Reports**: Creates sync reports and change logs
6. **Backup**: Maintains backups of all modified files

## Directory Structure

```
data/
├── postman/           # Downloaded Postman collections
├── operations/        # Extracted operations JSON files
├── programs/          # Program YAML configurations
└── backups/          # Backup files organized by timestamp
    ├── collections/
    ├── programs/
    ├── operations/
    └── reports/
```

## Operation Extraction

Operations are extracted with the following metadata:
- **Name**: Operation name from GraphQL or cleaned item name
- **Type**: `query` or `mutation`
- **Required**: Determined by operation name patterns
- **Category**: Based on Postman folder structure
- **Description**: From Postman item description

## Program Mappings

Collections are mapped to program types:
- `Trip.com` / `TripLink` → `ap_automation`
- `Consumer Credit` → `consumer_credit`
- `Consumer Prepaid` → `consumer_prepaid`
- `Commercial Credit` → `commercial_credit`
- `Commercial Prepaid` → `commercial_prepaid`

## Reports

Sync reports include:
- Timestamp
- Collections processed
- Operations extracted
- Programs updated
- Changes made
- Errors encountered

Reports are saved in:
- JSON: `backups/reports/sync_report_YYYY-MM-DD.json`
- Markdown: `backups/reports/latest_sync.md`

## Environment Variables

```bash
export POSTMAN_API_KEY=your-api-key
export POSTMAN_WORKSPACE_ID=your-workspace-id
```

## Running as a Service

### Using PM2

```bash
# Install PM2
npm install -g pm2

# Start the service
pm2 start "npx tsx src/cli/postman-sync.ts start" --name postman-sync

# Save PM2 configuration
pm2 save
pm2 startup
```

### Using systemd (Linux)

Create `/etc/systemd/system/postman-sync.service`:

```ini
[Unit]
Description=Postman Collections Sync
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/solution-generator
ExecStart=/usr/bin/node /path/to/solution-generator/dist/cli/postman-sync.js start
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable postman-sync
sudo systemctl start postman-sync
```

## Troubleshooting

### API Key Issues
- Ensure your API key has read access to collections
- Check workspace permissions

### Rate Limiting
- The system includes 200ms delays between API calls
- Adjust if you encounter rate limit errors

### Missing Operations
- Check the operations directory for extracted data
- Verify collection structure in Postman

### YAML Merge Conflicts
- Backups are created automatically
- Review changes in backup directory
- Disable `autoMerge` for manual control

## Advanced Usage

### Custom Program Mappings

Edit `postman-sync-config.json`:
```json
"programMappings": {
  "Your Collection Name": "your_program_type"
}
```

### Custom Cron Patterns

Examples:
- `*/30 * * * *` - Every 30 minutes
- `0 2,14 * * *` - At 2 AM and 2 PM
- `0 0 * * 1-5` - Weekdays at midnight

### Manual Operation Reference

Place existing operation files in the operations directory:
```json
{
  "operations": [
    {
      "name": "CreateCardProduct",
      "type": "mutation",
      "required": true,
      "description": "Creates a new card product"
    }
  ]
}
```

## Support

For issues or questions:
1. Check the logs in `backups/reports/`
2. Verify configuration in `postman-sync-config.json`
3. Run test extraction on individual collections
4. Review backup files for rollback if needed