#!/usr/bin/env python3
"""
Scheduled export of Postman collections with migration to Ship Agent
"""
import os
import sys
import schedule
import time
from datetime import datetime
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from src.postman_auto_exporter import PostmanAutoExporter
from src.postman_to_mongodb_migrator import PostmanToMongoDBMigrator


def export_and_migrate():
    """Export collections and migrate to Ship Agent format"""
    print(f"\n[{datetime.now()}] Starting scheduled export...")
    
    # 1. Export from Postman
    api_key = os.getenv('POSTMAN_API_KEY')
    if not api_key:
        print("Error: POSTMAN_API_KEY not set")
        return
    
    exporter = PostmanAutoExporter(api_key)
    exported = exporter.export_all_collections()
    
    # 2. Migrate each collection
    migrator = PostmanToMongoDBMigrator()
    
    for collection_name, info in exported.items():
        if 'file' in info:
            print(f"\nMigrating {collection_name}...")
            
            # Determine program type from collection name
            program_type = determine_program_type(collection_name)
            
            # Migrate
            result = migrator.migrate_collection(info['file'], program_type)
            print(f"  Migrated {result['total_operations']} operations")
    
    print(f"\n[{datetime.now()}] Export and migration complete!")


def determine_program_type(collection_name: str) -> str:
    """Determine program type from collection name"""
    name_lower = collection_name.lower()
    
    if 'consumer' in name_lower and 'credit' in name_lower:
        return 'consumer_credit'
    elif 'commercial' in name_lower:
        return 'commercial_credit'
    elif 'prepaid' in name_lower:
        return 'prepaid'
    elif 'acquiring' in name_lower:
        return 'acquiring'
    else:
        # Clean name for use as program type
        return name_lower.replace(' ', '_').replace('-', '_')


def run_scheduled_exports():
    """Run exports on a schedule"""
    # Export immediately on start
    export_and_migrate()
    
    # Schedule daily exports at 2 AM
    schedule.every().day.at("02:00").do(export_and_migrate)
    
    # Or export every 6 hours
    # schedule.every(6).hours.do(export_and_migrate)
    
    print("\nScheduled export running. Press Ctrl+C to stop.")
    print("Export schedule: Daily at 2:00 AM")
    
    while True:
        schedule.run_pending()
        time.sleep(60)  # Check every minute


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Scheduled Postman export')
    parser.add_argument('--once', action='store_true', help='Run once and exit')
    parser.add_argument('--schedule', action='store_true', help='Run on schedule')
    
    args = parser.parse_args()
    
    if args.once:
        export_and_migrate()
    else:
        run_scheduled_exports()