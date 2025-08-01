#!/usr/bin/env python3
"""
Automated Schema Update Pipeline for Schema Agent

This script automatically:
1. Fetches the latest GraphQL schema from the Highnote API
2. Runs the chunker to process the schema into chunks
3. Generates new embeddings for the chunks
4. Updates the retriever with the new embeddings
5. Optionally syncs to cloud storage

Usage:
    python update_schema.py --config config.json
    python update_schema.py --endpoint https://api.example.com/graphql --token your-token
    python update_schema.py --from-file schema.graphql
"""

import os
import sys
import json
import shutil
import hashlib
import argparse
import requests
import tempfile
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, Dict, Any
import logging
from dataclasses import dataclass

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

from agent.chunker import chunk_schema
from agent.embedder import Embedder
from agent.cloud_storage import cloud_storage

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/schema_update.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class SchemaUpdateConfig:
    """Configuration for schema update process."""
    graphql_endpoint: Optional[str] = None
    graphql_token: Optional[str] = None
    schema_file: Optional[str] = None
    output_dir: str = "schema"
    chunks_dir: str = "chunks"
    embeddings_dir: str = "embeddings"
    backup_dir: str = "backups"
    force_update: bool = False
    dry_run: bool = False
    sync_to_cloud: bool = True
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    batch_size: int = 16
    
    def __post_init__(self):
        """Validate configuration."""
        if not self.graphql_endpoint and not self.schema_file:
            raise ValueError("Either graphql_endpoint or schema_file must be provided")
        
        if self.graphql_endpoint and not self.graphql_token:
            raise ValueError("graphql_token is required when using graphql_endpoint")


class SchemaUpdater:
    """Handles the complete schema update pipeline."""
    
    def __init__(self, config: SchemaUpdateConfig):
        self.config = config
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")
        
        # Create directories
        for dir_path in [config.output_dir, config.chunks_dir, 
                        config.embeddings_dir, config.backup_dir, "logs"]:
            Path(dir_path).mkdir(parents=True, exist_ok=True)
    
    def fetch_schema_from_endpoint(self) -> str:
        """Fetch GraphQL schema from endpoint using introspection."""
        from graphql import get_introspection_query, build_client_schema, print_schema
        import base64
        
        self.logger.info(f"Fetching schema from {self.config.graphql_endpoint}")
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Basic {base64.b64encode(self.config.graphql_token.encode()).decode()}"
        }
        
        query = get_introspection_query(descriptions=True)
        
        try:
            response = requests.post(
                self.config.graphql_endpoint,
                json={"query": query},
                headers=headers,
                timeout=30
            )
            response.raise_for_status()
            
            data = response.json().get("data")
            if not data:
                raise ValueError("No data in GraphQL response")
            
            schema = build_client_schema(data)
            sdl = print_schema(schema)
            
            self.logger.info("Successfully fetched schema from endpoint")
            return sdl
            
        except requests.RequestException as e:
            self.logger.error(f"Failed to fetch schema: {e}")
            raise
        except Exception as e:
            self.logger.error(f"Failed to process schema: {e}")
            raise
    
    def load_schema_from_file(self) -> str:
        """Load GraphQL schema from local file."""
        schema_path = Path(self.config.schema_file)
        
        if not schema_path.exists():
            raise FileNotFoundError(f"Schema file not found: {schema_path}")
        
        self.logger.info(f"Loading schema from {schema_path}")
        return schema_path.read_text(encoding='utf-8')
    
    def get_schema_hash(self, schema_content: str) -> str:
        """Generate hash of schema content for change detection."""
        return hashlib.sha256(schema_content.encode('utf-8')).hexdigest()[:16]
    
    def check_schema_changed(self, new_schema: str) -> bool:
        """Check if schema has changed since last update."""
        new_hash = self.get_schema_hash(new_schema)
        
        # Check if there's an existing schema
        current_schema_path = Path(self.config.output_dir) / "highnote.graphql"
        if not current_schema_path.exists():
            self.logger.info("No existing schema found, proceeding with update")
            return True
        
        try:
            current_schema = current_schema_path.read_text(encoding='utf-8')
            current_hash = self.get_schema_hash(current_schema)
            
            if new_hash == current_hash:
                self.logger.info("Schema unchanged, skipping update")
                return False
            else:
                self.logger.info(f"Schema changed: {current_hash} -> {new_hash}")
                return True
                
        except Exception as e:
            self.logger.warning(f"Could not read existing schema: {e}")
            return True
    
    def backup_existing_data(self) -> str:
        """Create backup of existing schema, chunks, and embeddings."""
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        backup_path = Path(self.config.backup_dir) / f"backup_{timestamp}"
        backup_path.mkdir(parents=True, exist_ok=True)
        
        self.logger.info(f"Creating backup in {backup_path}")
        
        # Backup schema
        schema_file = Path(self.config.output_dir) / "highnote.graphql"
        if schema_file.exists():
            shutil.copy2(schema_file, backup_path / "highnote.graphql")
        
        # Backup chunks
        chunks_path = Path(self.config.chunks_dir)
        if chunks_path.exists() and any(chunks_path.glob("*.graphql")):
            backup_chunks = backup_path / "chunks"
            shutil.copytree(chunks_path, backup_chunks, dirs_exist_ok=True)
        
        # Backup embeddings
        embeddings_path = Path(self.config.embeddings_dir)
        if embeddings_path.exists():
            backup_embeddings = backup_path / "embeddings"
            backup_embeddings.mkdir(exist_ok=True)
            
            index_file = embeddings_path / "index.faiss"
            metadata_file = embeddings_path / "metadata.json"
            
            if index_file.exists():
                shutil.copy2(index_file, backup_embeddings / "index.faiss")
            if metadata_file.exists():
                shutil.copy2(metadata_file, backup_embeddings / "metadata.json")
        
        self.logger.info(f"Backup completed: {backup_path}")
        return str(backup_path)
    
    def save_schema(self, schema_content: str) -> str:
        """Save schema content to file."""
        schema_path = Path(self.config.output_dir) / "highnote.graphql"
        
        if self.config.dry_run:
            self.logger.info(f"[DRY RUN] Would save schema to {schema_path}")
            return str(schema_path)
        
        schema_path.write_text(schema_content, encoding='utf-8')
        self.logger.info(f"Schema saved to {schema_path}")
        return str(schema_path)
    
    def run_chunker(self, schema_path: str):
        """Run the chunker to process schema into chunks."""
        self.logger.info("Running chunker to process schema")
        
        if self.config.dry_run:
            self.logger.info(f"[DRY RUN] Would chunk schema from {schema_path} to {self.config.chunks_dir}")
            return
        
        # Clear existing chunks
        chunks_path = Path(self.config.chunks_dir)
        if chunks_path.exists():
            for chunk_file in chunks_path.glob("*.graphql"):
                chunk_file.unlink()
        
        try:
            chunk_schema(schema_path, self.config.chunks_dir)
            
            # Count generated chunks
            chunk_count = len(list(chunks_path.glob("*.graphql")))
            self.logger.info(f"Generated {chunk_count} chunks")
            
        except Exception as e:
            self.logger.error(f"Chunking failed: {e}")
            raise
    
    def generate_embeddings(self):
        """Generate embeddings for the chunks."""
        self.logger.info("Generating embeddings for chunks")
        
        if self.config.dry_run:
            self.logger.info(f"[DRY RUN] Would generate embeddings in {self.config.embeddings_dir}")
            return
        
        try:
            embedder = Embedder(
                model_name=self.config.embedding_model,
                batch_size=self.config.batch_size
            )
            
            # Generate embeddings
            embedder.embed_chunks(self.config.chunks_dir)
            
            # Save embeddings
            index_path = Path(self.config.embeddings_dir) / "index.faiss"
            metadata_path = Path(self.config.embeddings_dir) / "metadata.json"
            
            embedder.save(str(index_path), str(metadata_path))
            
            self.logger.info(f"Embeddings generated and saved to {self.config.embeddings_dir}")
            
        except Exception as e:
            self.logger.error(f"Embedding generation failed: {e}")
            raise
    
    def sync_to_cloud_storage(self):
        """Sync updated embeddings and chunks to cloud storage."""
        if not self.config.sync_to_cloud:
            self.logger.info("Cloud sync disabled, skipping")
            return
        
        if not cloud_storage.is_enabled():
            self.logger.warning("Cloud storage not enabled, skipping sync")
            return
        
        if self.config.dry_run:
            self.logger.info("[DRY RUN] Would sync to cloud storage")
            return
        
        self.logger.info("Syncing to cloud storage")
        
        try:
            # Upload embeddings
            if cloud_storage.upload_embeddings(self.config.embeddings_dir):
                self.logger.info("Embeddings synced to cloud storage")
            
            # Upload chunks
            if cloud_storage.upload_chunks(self.config.chunks_dir):
                self.logger.info("Chunks synced to cloud storage")
                
        except Exception as e:
            self.logger.error(f"Cloud sync failed: {e}")
            # Don't raise - this is not critical for local operation
    
    def cleanup_old_backups(self, keep_last: int = 5):
        """Clean up old backup directories."""
        backup_path = Path(self.config.backup_dir)
        if not backup_path.exists():
            return
        
        backup_dirs = sorted(
            [d for d in backup_path.iterdir() if d.is_dir() and d.name.startswith("backup_")],
            key=lambda x: x.stat().st_mtime,
            reverse=True
        )
        
        dirs_to_remove = backup_dirs[keep_last:]
        
        for old_backup in dirs_to_remove:
            if self.config.dry_run:
                self.logger.info(f"[DRY RUN] Would remove old backup: {old_backup}")
            else:
                shutil.rmtree(old_backup)
                self.logger.info(f"Removed old backup: {old_backup}")
    
    def update_schema(self) -> Dict[str, Any]:
        """Run the complete schema update pipeline."""
        start_time = datetime.now(timezone.utc)
        self.logger.info("Starting schema update pipeline")
        
        results = {
            "success": False,
            "start_time": start_time.isoformat(),
            "schema_changed": False,
            "backup_path": None,
            "error": None
        }
        
        try:
            # 1. Fetch or load schema
            if self.config.graphql_endpoint:
                schema_content = self.fetch_schema_from_endpoint()
            else:
                schema_content = self.load_schema_from_file()
            
            # 2. Check if schema changed
            if not self.config.force_update and not self.check_schema_changed(schema_content):
                results["success"] = True
                results["schema_changed"] = False
                return results
            
            results["schema_changed"] = True
            
            # 3. Create backup
            if not self.config.dry_run:
                backup_path = self.backup_existing_data()
                results["backup_path"] = backup_path
            
            # 4. Save new schema
            schema_path = self.save_schema(schema_content)
            
            # 5. Run chunker
            self.run_chunker(schema_path)
            
            # 6. Generate embeddings
            self.generate_embeddings()
            
            # 7. Sync to cloud storage
            self.sync_to_cloud_storage()
            
            # 8. Cleanup old backups
            self.cleanup_old_backups()
            
            results["success"] = True
            end_time = datetime.now(timezone.utc)
            results["end_time"] = end_time.isoformat()
            results["duration_seconds"] = (end_time - start_time).total_seconds()
            
            self.logger.info(f"Schema update completed successfully in {results['duration_seconds']:.2f}s")
            
        except Exception as e:
            self.logger.error(f"Schema update failed: {e}")
            results["error"] = str(e)
            results["success"] = False
            
            # Try to restore from backup if we have one
            if results.get("backup_path") and not self.config.dry_run:
                self.logger.info("Attempting to restore from backup")
                try:
                    self.restore_from_backup(results["backup_path"])
                    self.logger.info("Successfully restored from backup")
                except Exception as restore_error:
                    self.logger.error(f"Failed to restore from backup: {restore_error}")
        
        return results
    
    def restore_from_backup(self, backup_path: str):
        """Restore schema, chunks, and embeddings from backup."""
        backup_dir = Path(backup_path)
        
        if not backup_dir.exists():
            raise FileNotFoundError(f"Backup directory not found: {backup_dir}")
        
        # Restore schema
        backup_schema = backup_dir / "highnote.graphql"
        if backup_schema.exists():
            shutil.copy2(backup_schema, Path(self.config.output_dir) / "highnote.graphql")
        
        # Restore chunks
        backup_chunks = backup_dir / "chunks"
        if backup_chunks.exists():
            chunks_path = Path(self.config.chunks_dir)
            if chunks_path.exists():
                shutil.rmtree(chunks_path)
            shutil.copytree(backup_chunks, chunks_path)
        
        # Restore embeddings
        backup_embeddings = backup_dir / "embeddings"
        if backup_embeddings.exists():
            embeddings_path = Path(self.config.embeddings_dir)
            
            backup_index = backup_embeddings / "index.faiss"
            backup_metadata = backup_embeddings / "metadata.json"
            
            if backup_index.exists():
                shutil.copy2(backup_index, embeddings_path / "index.faiss")
            if backup_metadata.exists():
                shutil.copy2(backup_metadata, embeddings_path / "metadata.json")


def load_config_from_file(config_path: str) -> SchemaUpdateConfig:
    """Load configuration from JSON file."""
    config_file = Path(config_path)
    
    if not config_file.exists():
        raise FileNotFoundError(f"Config file not found: {config_path}")
    
    with open(config_file, 'r') as f:
        config_data = json.load(f)
    
    return SchemaUpdateConfig(**config_data)


def main():
    parser = argparse.ArgumentParser(
        description="Automated GraphQL Schema Update Pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Update from GraphQL endpoint
    python update_schema.py --endpoint https://api.example.com/graphql --token YOUR_TOKEN
    
    # Update from local file
    python update_schema.py --from-file schema.graphql
    
    # Use configuration file
    python update_schema.py --config config.json
    
    # Dry run to see what would happen
    python update_schema.py --config config.json --dry-run
    
    # Force update even if schema hasn't changed
    python update_schema.py --config config.json --force
        """
    )
    
    # Configuration options
    parser.add_argument("--config", help="Path to JSON configuration file")
    parser.add_argument("--endpoint", help="GraphQL endpoint URL")
    parser.add_argument("--token", help="GraphQL authentication token")
    parser.add_argument("--from-file", help="Load schema from local file")
    
    # Directories
    parser.add_argument("--output-dir", default="schema", help="Schema output directory")
    parser.add_argument("--chunks-dir", default="chunks", help="Chunks output directory")
    parser.add_argument("--embeddings-dir", default="embeddings", help="Embeddings output directory")
    parser.add_argument("--backup-dir", default="backups", help="Backup directory")
    
    # Options
    parser.add_argument("--force", action="store_true", help="Force update even if schema unchanged")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done without making changes")
    parser.add_argument("--no-cloud-sync", action="store_true", help="Skip cloud storage sync")
    parser.add_argument("--embedding-model", default="sentence-transformers/all-MiniLM-L6-v2", help="Embedding model to use")
    parser.add_argument("--batch-size", type=int, default=16, help="Batch size for embedding generation")
    
    # Logging
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable verbose logging")
    parser.add_argument("--quiet", "-q", action="store_true", help="Quiet mode (errors only)")
    
    args = parser.parse_args()
    
    # Configure logging
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    elif args.quiet:
        logging.getLogger().setLevel(logging.ERROR)
    
    try:
        # Load configuration
        if args.config:
            config = load_config_from_file(args.config)
        else:
            config = SchemaUpdateConfig(
                graphql_endpoint=args.endpoint,
                graphql_token=args.token,
                schema_file=args.from_file,
                output_dir=args.output_dir,
                chunks_dir=args.chunks_dir,
                embeddings_dir=args.embeddings_dir,
                backup_dir=args.backup_dir,
                force_update=args.force,
                dry_run=args.dry_run,
                sync_to_cloud=not args.no_cloud_sync,
                embedding_model=args.embedding_model,
                batch_size=args.batch_size
            )
        
        # Override config with command line args if provided
        if args.force:
            config.force_update = True
        if args.dry_run:
            config.dry_run = True
        if args.no_cloud_sync:
            config.sync_to_cloud = False
        
        # Run update
        updater = SchemaUpdater(config)
        results = updater.update_schema()
        
        # Print results
        print("\n" + "="*50)
        print("SCHEMA UPDATE RESULTS")
        print("="*50)
        print(f"Success: {results['success']}")
        print(f"Schema Changed: {results['schema_changed']}")
        if results.get('duration_seconds'):
            print(f"Duration: {results['duration_seconds']:.2f} seconds")
        if results.get('backup_path'):
            print(f"Backup: {results['backup_path']}")
        if results.get('error'):
            print(f"Error: {results['error']}")
        print("="*50)
        
        # Exit with appropriate code
        sys.exit(0 if results['success'] else 1)
        
    except Exception as e:
        logger.error(f"Update failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()