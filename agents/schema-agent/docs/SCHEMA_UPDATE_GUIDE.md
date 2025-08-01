# Schema Update Automation Guide

This guide explains how to use the automated schema update system that pulls the latest Highnote GraphQL schema, runs the chunker, and regenerates embeddings.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Configuration](#configuration)
3. [Manual Updates](#manual-updates)
4. [Scheduled Updates](#scheduled-updates)
5. [Cloud Deployment](#cloud-deployment)
6. [Monitoring](#monitoring)
7. [Troubleshooting](#troubleshooting)

## Quick Start

### 1. Basic Setup

```bash
# Install additional dependencies
pip install schedule flask

# Create configuration file
cp config.json.example config.json
# Edit config.json with your GraphQL endpoint and token
```

### 2. Manual Update

```bash
# Simple update using config file
./update_schema.sh

# Update from specific endpoint
./update_schema.sh --endpoint https://api.example.com/graphql --token YOUR_TOKEN

# Dry run to see what would happen
./update_schema.sh --dry-run

# Force update even if schema unchanged
./update_schema.sh --force
```

### 3. Python Script Usage

```bash
# Using Python directly
python update_schema.py --config config.json

# From file instead of endpoint
python update_schema.py --from-file schema.graphql

# With custom options
python update_schema.py \
    --endpoint https://api.example.com/graphql \
    --token YOUR_TOKEN \
    --force \
    --verbose
```

## Configuration

### Update Configuration (`config.json`)

```json
{
  "graphql_endpoint": "https://sandbox.highnoteplatform.com/graphql",
  "graphql_token": "YOUR_TOKEN_HERE",
  "output_dir": "schema",
  "chunks_dir": "chunks", 
  "embeddings_dir": "embeddings",
  "backup_dir": "backups",
  "force_update": false,
  "dry_run": false,
  "sync_to_cloud": true,
  "embedding_model": "sentence-transformers/all-MiniLM-L6-v2",
  "batch_size": 16
}
```

### Schedule Configuration (`schedule_config.json`)

```json
{
  "enabled": true,
  "simple_schedule": "every 6 hours",
  "webhook_enabled": true,
  "webhook_secret": "your-webhook-secret-here",
  "status_endpoint": true,
  "max_concurrent_updates": 1
}
```

## Manual Updates

### Command Line Options

```bash
# Basic options
./update_schema.sh --help                    # Show help
./update_schema.sh --config config.json     # Use config file
./update_schema.sh --dry-run                 # Preview changes
./update_schema.sh --force                   # Force update
./update_schema.sh --verbose                 # Detailed logging

# Source options  
./update_schema.sh --endpoint URL --token TOKEN  # From GraphQL endpoint
./update_schema.sh --file schema.graphql         # From local file

# Advanced options
./update_schema.sh --no-cloud-sync          # Skip cloud storage sync
./update_schema.sh --embedding-model MODEL  # Custom embedding model
./update_schema.sh --batch-size 32          # Custom batch size
```

### Environment Variables

```bash
# Set environment variables
export GRAPHQL_ENDPOINT="https://api.example.com/graphql"
export GRAPHQL_TOKEN="your-token-here"
export UPDATE_CONFIG="custom-config.json"

# Run update
./update_schema.sh
```

## Scheduled Updates

### 1. Start the Scheduler

```bash
# Start scheduler with web interface
python schedule_updates.py

# Custom configuration
python schedule_updates.py --schedule-config my_schedule.json --port 5001
```

### 2. Web Interface

Once the scheduler is running, you can access:

- **Health Check**: `http://localhost:5001/health`
- **Status**: `http://localhost:5001/status`
- **History**: `http://localhost:5001/history`

### 3. Manual Triggers

```bash
# Trigger update via API
curl -X POST http://localhost:5001/trigger \
    -H "Content-Type: application/json" \
    -d '{"force": false, "dry_run": false}'

# With authentication
curl -X POST http://localhost:5001/trigger \
    -H "Authorization: Bearer your-webhook-secret" \
    -H "Content-Type: application/json" \
    -d '{"force": true}'
```

### 4. Webhook Integration

```bash
# GitHub webhook example
curl -X POST http://localhost:5001/webhook \
    -H "X-Hub-Signature-256: sha256=..." \
    -H "Content-Type: application/json" \
    -d '{"ref": "refs/heads/main"}'
```

### 5. Schedule Formats

```json
{
  "simple_schedule": "every 6 hours",     // Every N hours
  "simple_schedule": "every 30 minutes",  // Every N minutes
  "simple_schedule": "daily at 02:00",    // Daily at specific time
  "simple_schedule": "hourly",            // Every hour
  "simple_schedule": "daily"              // Daily at 02:00
}
```

## Cloud Deployment

### 1. Google Cloud Scheduler

```bash
# Deploy Cloud Scheduler for automated updates
./gcp/deploy-cloud-scheduler.sh your-project-id "0 */6 * * *"

# Set required environment variables
export GRAPHQL_ENDPOINT="https://api.example.com/graphql"
export GRAPHQL_TOKEN="your-token"

# Run deployment
./gcp/deploy-cloud-scheduler.sh
```

### 2. Cloud Function Management

```bash
# View function logs
gcloud functions logs read schema-updater --limit 50

# Trigger manually
gcloud scheduler jobs run schema-update-job

# Update function
gcloud functions deploy schema-updater --source gcp/cloud-functions/schema-updater
```

### 3. Integration with Cloud Run

When deploying the main application to Cloud Run, the updater can automatically sync to Cloud Storage:

```bash
# Deploy with storage integration
gcloud run deploy schema-agent \
    --set-env-vars="STORAGE_BUCKET=your-bucket,SYNC_TO_CLOUD=true"
```

## Monitoring

### 1. Log Files

```bash
# Update logs
tail -f logs/schema_update.log

# Scheduler logs  
tail -f logs/scheduler.log

# API server logs
tail -f logs/api_server.log
```

### 2. Status Checking

```bash
# Check last update status
curl http://localhost:5001/status | jq '.last_update'

# Check update history
curl http://localhost:5001/history?limit=10
```

### 3. Cloud Monitoring

```bash
# Cloud Function logs
gcloud logging read "resource.type=cloud_function AND resource.labels.function_name=schema-updater"

# Cloud Scheduler job status
gcloud scheduler jobs describe schema-update-job
```

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   ```bash
   # Verify token
   curl -H "Authorization: Basic $(echo -n 'your-token' | base64)" \
        -H "Content-Type: application/json" \
        -d '{"query": "query { __typename }"}' \
        https://api.example.com/graphql
   ```

2. **Permission Errors**
   ```bash
   # Check file permissions
   ls -la embeddings/ chunks/
   
   # Fix permissions
   chmod -R 755 embeddings/ chunks/ backups/
   ```

3. **Memory Issues**
   ```bash
   # Reduce batch size
   python update_schema.py --batch-size 8
   
   # Use smaller embedding model
   python update_schema.py --embedding-model sentence-transformers/all-MiniLM-L12-v2
   ```

4. **Network Issues**
   ```bash
   # Test connectivity
   curl -I https://api.example.com/graphql
   
   # Use proxy if needed
   export HTTP_PROXY=http://proxy:8080
   export HTTPS_PROXY=http://proxy:8080
   ```

### Debug Mode

```bash
# Enable verbose logging
python update_schema.py --verbose

# Dry run for testing
python update_schema.py --dry-run --verbose

# Check specific step
python -c "
from update_schema import SchemaUpdater, SchemaUpdateConfig
config = SchemaUpdateConfig(graphql_endpoint='...', graphql_token='...')
updater = SchemaUpdater(config)
schema = updater.fetch_schema_from_endpoint()
print('Schema length:', len(schema))
"
```

### Recovery

```bash
# Restore from backup
ls -la backups/
cp -r backups/backup_20231201_120000/* .

# Reset embeddings
rm -rf embeddings/*
python -c "
from agent.embedder import Embedder
embedder = Embedder()
embedder.embed_chunks('chunks')
embedder.save('embeddings/index.faiss', 'embeddings/metadata.json')
"
```

## Advanced Usage

### 1. Custom Processing Pipeline

```python
from update_schema import SchemaUpdater, SchemaUpdateConfig

# Custom configuration
config = SchemaUpdateConfig(
    graphql_endpoint="https://api.example.com/graphql",
    graphql_token="your-token",
    embedding_model="sentence-transformers/all-mpnet-base-v2",
    batch_size=8,
    sync_to_cloud=True
)

# Custom updater with hooks
class CustomUpdater(SchemaUpdater):
    def post_chunk_hook(self, chunks_dir):
        # Custom processing after chunking
        print(f"Processed {len(list(Path(chunks_dir).glob('*.graphql')))} chunks")
    
    def post_embedding_hook(self, embeddings_dir):
        # Custom processing after embedding
        print("Embeddings generated successfully")

updater = CustomUpdater(config)
result = updater.update_schema()
```

### 2. Integration with CI/CD

```yaml
# GitHub Actions example
name: Update Schema
on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
  workflow_dispatch:       # Manual trigger

jobs:
  update-schema:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: pip install -r requirements.txt
      
      - name: Update schema
        env:
          GRAPHQL_ENDPOINT: ${{ secrets.GRAPHQL_ENDPOINT }}
          GRAPHQL_TOKEN: ${{ secrets.GRAPHQL_TOKEN }}
        run: python update_schema.py --config config.json
      
      - name: Deploy to Cloud Run
        run: gcloud run deploy schema-agent --image gcr.io/${{ secrets.PROJECT_ID }}/schema-agent
```

### 3. Multiple Environment Support

```bash
# Development environment
python update_schema.py --config config-dev.json

# Staging environment  
python update_schema.py --config config-staging.json

# Production environment
python update_schema.py --config config-prod.json --no-dry-run
```

## Best Practices

1. **Always test with `--dry-run` first**
2. **Monitor update frequency to avoid rate limiting**
3. **Keep backups of working embeddings**
4. **Use Cloud Storage for production deployments**
5. **Set up monitoring and alerting**
6. **Validate schema changes before applying**
7. **Use webhooks for real-time updates**
8. **Keep update logs for debugging**

---

For more details, see the main [README](README.md) and [GCP_DEPLOYMENT](GCP_DEPLOYMENT.md) guides.