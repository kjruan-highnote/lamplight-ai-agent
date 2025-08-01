"""
Google Cloud Function for Schema Updates

This Cloud Function can be triggered by:
- HTTP requests
- Cloud Scheduler (cron jobs)  
- Pub/Sub messages
- GitHub webhooks

Deployment:
    gcloud functions deploy schema-updater \
        --runtime python39 \
        --trigger-http \
        --entry-point main \
        --memory 2GB \
        --timeout 540s
"""

import os
import json
import tempfile
import zipfile
from typing import Dict, Any
import logging
from google.cloud import storage
import functions_framework

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def download_source_code():
    """Download the schema agent source code from Cloud Storage."""
    bucket_name = os.environ.get('SOURCE_BUCKET')
    if not bucket_name:
        raise ValueError("SOURCE_BUCKET environment variable not set")
    
    client = storage.Client()
    bucket = client.bucket(bucket_name)
    
    # Download source code zip
    blob = bucket.blob('source/schema-agent.zip')
    
    with tempfile.NamedTemporaryFile(suffix='.zip', delete=False) as temp_file:
        blob.download_to_filename(temp_file.name)
        
        # Extract source code
        extract_dir = tempfile.mkdtemp()
        with zipfile.ZipFile(temp_file.name, 'r') as zip_ref:
            zip_ref.extractall(extract_dir)
        
        return extract_dir

def run_schema_update(config: Dict[str, Any]) -> Dict[str, Any]:
    """Run the schema update process."""
    import sys
    from pathlib import Path
    
    # Download and set up source code
    source_dir = download_source_code()
    sys.path.insert(0, source_dir)
    
    # Import schema updater
    from update_schema import SchemaUpdater, SchemaUpdateConfig
    
    # Create config
    update_config = SchemaUpdateConfig(**config)
    
    # Force cloud sync for Cloud Functions
    update_config.sync_to_cloud = True
    
    # Run update
    updater = SchemaUpdater(update_config)
    result = updater.update_schema()
    
    return result

@functions_framework.http
def main(request):
    """HTTP Cloud Function entry point."""
    try:
        # Parse request
        if request.method == 'GET':
            # Simple trigger
            config = {
                'graphql_endpoint': os.environ.get('GRAPHQL_ENDPOINT'),
                'graphql_token': os.environ.get('GRAPHQL_TOKEN'),
                'force_update': request.args.get('force', 'false').lower() == 'true'
            }
        elif request.method == 'POST':
            # JSON configuration
            request_json = request.get_json(silent=True)
            if request_json:
                config = request_json
            else:
                config = {
                    'graphql_endpoint': os.environ.get('GRAPHQL_ENDPOINT'),
                    'graphql_token': os.environ.get('GRAPHQL_TOKEN')
                }
        else:
            return {'error': 'Method not allowed'}, 405
        
        # Validate required config
        if not config.get('graphql_endpoint'):
            return {'error': 'graphql_endpoint required'}, 400
        if not config.get('graphql_token'):
            return {'error': 'graphql_token required'}, 400
        
        # Run update
        logger.info("Starting schema update via Cloud Function")
        result = run_schema_update(config)
        
        # Return result
        return {
            'success': result['success'],
            'schema_changed': result.get('schema_changed', False),
            'duration_seconds': result.get('duration_seconds'),
            'error': result.get('error')
        }
        
    except Exception as e:
        logger.error(f"Cloud Function failed: {e}")
        return {'error': str(e)}, 500

@functions_framework.cloud_event
def pubsub_trigger(cloud_event):
    """Pub/Sub trigger entry point."""
    import base64
    
    try:
        # Decode Pub/Sub message
        message_data = cloud_event.data["message"]["data"]
        decoded_data = base64.b64decode(message_data).decode('utf-8')
        
        try:
            config = json.loads(decoded_data)
        except json.JSONDecodeError:
            # Treat as simple trigger
            config = {
                'graphql_endpoint': os.environ.get('GRAPHQL_ENDPOINT'),
                'graphql_token': os.environ.get('GRAPHQL_TOKEN')
            }
        
        # Run update
        logger.info("Starting schema update via Pub/Sub trigger")
        result = run_schema_update(config)
        
        logger.info(f"Schema update completed: {result['success']}")
        
    except Exception as e:
        logger.error(f"Pub/Sub trigger failed: {e}")
        raise