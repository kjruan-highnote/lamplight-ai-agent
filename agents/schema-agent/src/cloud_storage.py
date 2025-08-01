"""
Cloud Storage integration for Schema Agent
Handles loading/saving embeddings and data from GCS
"""

import os
import logging
import tempfile
from pathlib import Path
from typing import Optional
from google.cloud import storage
from google.api_core import exceptions

logger = logging.getLogger(__name__)

class CloudStorageManager:
    """Manages Cloud Storage operations for the Schema Agent."""
    
    def __init__(self, bucket_name: Optional[str] = None, project_id: Optional[str] = None):
        """
        Initialize Cloud Storage manager.
        
        Args:
            bucket_name: GCS bucket name (defaults to env var STORAGE_BUCKET)
            project_id: GCP project ID (defaults to env var GOOGLE_CLOUD_PROJECT)
        """
        self.bucket_name = bucket_name or os.getenv('STORAGE_BUCKET')
        self.project_id = project_id or os.getenv('GOOGLE_CLOUD_PROJECT')
        
        if not self.bucket_name:
            logger.warning("No storage bucket configured. Cloud storage disabled.")
            self.client = None
            self.bucket = None
            return
            
        try:
            self.client = storage.Client(project=self.project_id)
            self.bucket = self.client.bucket(self.bucket_name)
            logger.info(f"Cloud Storage initialized: gs://{self.bucket_name}")
        except Exception as e:
            logger.warning(f"Failed to initialize Cloud Storage: {e}")
            self.client = None
            self.bucket = None
    
    def is_enabled(self) -> bool:
        """Check if cloud storage is properly configured."""
        return self.client is not None and self.bucket is not None
    
    def download_embeddings(self, local_dir: str = "embeddings") -> bool:
        """
        Download embeddings from Cloud Storage to local directory.
        
        Args:
            local_dir: Local directory to download embeddings to
            
        Returns:
            True if successful, False otherwise
        """
        if not self.is_enabled():
            logger.debug("Cloud storage not enabled, skipping download")
            return False
            
        try:
            local_path = Path(local_dir)
            local_path.mkdir(parents=True, exist_ok=True)
            
            # Download index and metadata files
            files_to_download = [
                ("embeddings/index.faiss", "index.faiss"),
                ("embeddings/metadata.json", "metadata.json")
            ]
            
            downloaded_any = False
            for remote_path, local_filename in files_to_download:
                try:
                    blob = self.bucket.blob(remote_path)
                    if blob.exists():
                        local_file_path = local_path / local_filename
                        blob.download_to_filename(str(local_file_path))
                        logger.info(f"Downloaded {remote_path} -> {local_file_path}")
                        downloaded_any = True
                    else:
                        logger.debug(f"Remote file not found: gs://{self.bucket_name}/{remote_path}")
                except exceptions.NotFound:
                    logger.debug(f"File not found in storage: {remote_path}")
                except Exception as e:
                    logger.error(f"Failed to download {remote_path}: {e}")
            
            return downloaded_any
            
        except Exception as e:
            logger.error(f"Failed to download embeddings: {e}")
            return False
    
    def upload_embeddings(self, local_dir: str = "embeddings") -> bool:
        """
        Upload embeddings from local directory to Cloud Storage.
        
        Args:
            local_dir: Local directory containing embeddings
            
        Returns:
            True if successful, False otherwise
        """
        if not self.is_enabled():
            logger.debug("Cloud storage not enabled, skipping upload")
            return False
            
        try:
            local_path = Path(local_dir)
            if not local_path.exists():
                logger.warning(f"Local embeddings directory not found: {local_dir}")
                return False
            
            # Upload index and metadata files
            files_to_upload = [
                ("index.faiss", "embeddings/index.faiss"),
                ("metadata.json", "embeddings/metadata.json")
            ]
            
            uploaded_any = False
            for local_filename, remote_path in files_to_upload:
                local_file_path = local_path / local_filename
                if local_file_path.exists():
                    try:
                        blob = self.bucket.blob(remote_path)
                        blob.upload_from_filename(str(local_file_path))
                        logger.info(f"Uploaded {local_file_path} -> gs://{self.bucket_name}/{remote_path}")
                        uploaded_any = True
                    except Exception as e:
                        logger.error(f"Failed to upload {local_file_path}: {e}")
                else:
                    logger.debug(f"Local file not found: {local_file_path}")
            
            return uploaded_any
            
        except Exception as e:
            logger.error(f"Failed to upload embeddings: {e}")
            return False
    
    def download_chunks(self, local_dir: str = "chunks") -> bool:
        """
        Download chunks from Cloud Storage to local directory.
        
        Args:
            local_dir: Local directory to download chunks to
            
        Returns:
            True if successful, False otherwise
        """
        if not self.is_enabled():
            logger.debug("Cloud storage not enabled, skipping download")
            return False
            
        try:
            local_path = Path(local_dir)
            local_path.mkdir(parents=True, exist_ok=True)
            
            # List all blobs in chunks folder
            blobs = self.client.list_blobs(self.bucket_name, prefix="data/chunks/")
            
            downloaded_count = 0
            for blob in blobs:
                if blob.name.endswith('.graphql'):
                    local_filename = Path(blob.name).name
                    local_file_path = local_path / local_filename
                    
                    try:
                        blob.download_to_filename(str(local_file_path))
                        downloaded_count += 1
                    except Exception as e:
                        logger.error(f"Failed to download {blob.name}: {e}")
            
            if downloaded_count > 0:
                logger.info(f"Downloaded {downloaded_count} chunk files")
                return True
            else:
                logger.debug("No chunk files found in storage")
                return False
            
        except Exception as e:
            logger.error(f"Failed to download chunks: {e}")
            return False
    
    def upload_chunks(self, local_dir: str = "chunks") -> bool:
        """
        Upload chunks from local directory to Cloud Storage.
        
        Args:
            local_dir: Local directory containing chunks
            
        Returns:
            True if successful, False otherwise
        """
        if not self.is_enabled():
            logger.debug("Cloud storage not enabled, skipping upload")
            return False
            
        try:
            local_path = Path(local_dir)
            if not local_path.exists():
                logger.warning(f"Local chunks directory not found: {local_dir}")
                return False
            
            uploaded_count = 0
            for graphql_file in local_path.glob("*.graphql"):
                remote_path = f"data/chunks/{graphql_file.name}"
                
                try:
                    blob = self.bucket.blob(remote_path)
                    blob.upload_from_filename(str(graphql_file))
                    uploaded_count += 1
                except Exception as e:
                    logger.error(f"Failed to upload {graphql_file}: {e}")
            
            if uploaded_count > 0:
                logger.info(f"Uploaded {uploaded_count} chunk files")
                return True
            else:
                logger.debug("No chunk files found to upload")
                return False
            
        except Exception as e:
            logger.error(f"Failed to upload chunks: {e}")
            return False
    
    def sync_from_cloud(self, force: bool = False) -> bool:
        """
        Sync embeddings and chunks from cloud storage to local.
        
        Args:
            force: Force download even if local files exist
            
        Returns:
            True if any files were synced, False otherwise
        """
        if not self.is_enabled():
            return False
        
        synced_any = False
        
        # Check if we need to download embeddings
        embeddings_exist = (
            Path("embeddings/index.faiss").exists() and 
            Path("embeddings/metadata.json").exists()
        )
        
        if force or not embeddings_exist:
            logger.info("Syncing embeddings from cloud storage...")
            if self.download_embeddings():
                synced_any = True
        
        # Check if we need to download chunks
        chunks_exist = Path("chunks").exists() and any(Path("chunks").glob("*.graphql"))
        
        if force or not chunks_exist:
            logger.info("Syncing chunks from cloud storage...")
            if self.download_chunks():
                synced_any = True
        
        return synced_any
    
    def get_stats(self) -> dict:
        """Get cloud storage statistics."""
        stats = {
            "enabled": self.is_enabled(),
            "bucket_name": self.bucket_name,
            "project_id": self.project_id
        }
        
        if self.is_enabled():
            try:
                # Count files in each folder
                embeddings_count = sum(1 for _ in self.client.list_blobs(self.bucket_name, prefix="embeddings/"))
                chunks_count = sum(1 for _ in self.client.list_blobs(self.bucket_name, prefix="data/chunks/"))
                
                stats.update({
                    "embeddings_files": embeddings_count,
                    "chunks_files": chunks_count,
                    "bucket_exists": self.bucket.exists()
                })
            except Exception as e:
                stats["error"] = str(e)
        
        return stats


# Global instance
cloud_storage = CloudStorageManager()


def ensure_embeddings_available() -> bool:
    """
    Ensure embeddings are available locally, downloading from cloud if needed.
    
    Returns:
        True if embeddings are available locally, False otherwise
    """
    embeddings_path = Path("embeddings")
    index_file = embeddings_path / "index.faiss"
    metadata_file = embeddings_path / "metadata.json"
    
    # Check if embeddings already exist locally
    if index_file.exists() and metadata_file.exists():
        logger.debug("Embeddings already available locally")
        return True
    
    # Try to download from cloud storage
    if cloud_storage.is_enabled():
        logger.info("Embeddings not found locally, downloading from cloud storage...")
        return cloud_storage.download_embeddings()
    
    logger.warning("Embeddings not available locally and cloud storage not configured")
    return False


def ensure_chunks_available() -> bool:
    """
    Ensure chunks are available locally, downloading from cloud if needed.
    
    Returns:
        True if chunks are available locally, False otherwise
    """
    chunks_path = Path("chunks")
    
    # Check if chunks already exist locally
    if chunks_path.exists() and any(chunks_path.glob("*.graphql")):
        logger.debug("Chunks already available locally")
        return True
    
    # Try to download from cloud storage
    if cloud_storage.is_enabled():
        logger.info("Chunks not found locally, downloading from cloud storage...")
        return cloud_storage.download_chunks()
    
    logger.warning("Chunks not available locally and cloud storage not configured")
    return False